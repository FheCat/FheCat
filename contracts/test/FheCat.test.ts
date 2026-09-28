import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { FheTypes } from '@cofhe/sdk';
import { contractUri, tokenUri } from '../../art';
import {
  AL_PRICE,
  MAX_SUPPLY,
  PRICE,
  Phase,
  ROYALTY_BPS,
  cofheFor,
  decodeDataUri,
  deployFixture,
  dnaHandle,
  mintPublic,
  mockPlaintext,
} from './helpers';

describe('FheCat', () => {
  describe('deployment', () => {
    it('sets collection parameters', async () => {
      const { nft, owner, treasury } = await loadFixture(deployFixture);
      expect(await nft.name()).to.equal('FheCat');
      expect(await nft.symbol()).to.equal('FCAT');
      expect(await nft.maxSupply()).to.equal(MAX_SUPPLY);
      expect(await nft.owner()).to.equal(owner.address);
      expect(await nft.phase()).to.equal(Phase.Closed);
      const [receiver, amount] = await nft.royaltyInfo(1, 10_000);
      expect(receiver).to.equal(treasury.address);
      expect(amount).to.equal(ROYALTY_BPS);
    });

    it('supports ERC-721, ERC-2981 and ERC-4906', async () => {
      const { nft } = await loadFixture(deployFixture);
      for (const id of ['0x80ac58cd', '0x5b5e139f', '0x2a55205a', '0x49064906', '0x01ffc9a7']) {
        expect(await nft.supportsInterface(id), id).to.equal(true);
      }
    });
  });

  describe('public mint', () => {
    it('is closed until the owner opens it', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      await expect(nft.connect(alice).mint(1, { value: PRICE })).to.be.revertedWithCustomError(nft, 'SaleNotActive');
    });

    it('mints cats with an encrypted DNA handle each', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      await nft.setPhase(Phase.Public);
      const tx = nft.connect(alice).mint(3, { value: PRICE * 3n });
      await expect(tx).to.emit(nft, 'CatBorn');
      await expect(tx).to.emit(nft, 'Transfer').withArgs(ethers.ZeroAddress, alice.address, 3n);

      expect(await nft.totalSupply()).to.equal(3n);
      expect(await nft.balanceOf(alice.address)).to.equal(3n);
      const handles = new Set<string>();
      for (const id of [1n, 2n, 3n]) {
        const cat = await nft.catOf(id);
        expect(cat.owner).to.equal(alice.address);
        expect(cat.revealed).to.equal(false);
        expect(cat.dna).to.equal(0n);
        expect(cat.dnaHandle).to.not.equal(ethers.ZeroHash);
        handles.add(cat.dnaHandle);
      }
      expect(handles.size).to.equal(3);
    });

    it('charges exactly price x quantity', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      await nft.setPhase(Phase.Public);
      await expect(nft.connect(alice).mint(2, { value: PRICE }))
        .to.be.revertedWithCustomError(nft, 'WrongPayment')
        .withArgs(PRICE * 2n);
      await expect(nft.connect(alice).mint(1, { value: PRICE * 2n })).to.be.revertedWithCustomError(nft, 'WrongPayment');
      await expect(nft.connect(alice).mint(2, { value: PRICE * 2n })).to.changeEtherBalance(nft, PRICE * 2n);
    });

    it('enforces quantity, wallet and supply limits', async () => {
      const { nft, owner, alice, bob } = await loadFixture(deployFixture);
      await nft.setPhase(Phase.Public);
      await expect(nft.connect(alice).mint(0)).to.be.revertedWithCustomError(nft, 'InvalidQuantity');
      await expect(nft.connect(alice).mint(11, { value: PRICE * 11n })).to.be.revertedWithCustomError(nft, 'InvalidQuantity');

      await nft.connect(alice).mint(5, { value: PRICE * 5n });
      await expect(nft.connect(alice).mint(1, { value: PRICE })).to.be.revertedWithCustomError(nft, 'ExceedsWalletLimit');

      await nft.setWalletLimits(0, 0); // unlimited
      await nft.ownerMint(owner.address, 10);
      await nft.connect(bob).mint(10, { value: PRICE * 10n });
      expect(await nft.totalSupply()).to.equal(MAX_SUPPLY);
      await expect(nft.connect(bob).mint(1, { value: PRICE })).to.be.revertedWithCustomError(nft, 'ExceedsMaxSupply');
    });

    it('lets only the owner reserve-mint', async () => {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      await expect(nft.connect(alice).ownerMint(alice.address, 1)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
      await nft.ownerMint(bob.address, 4); // works while the sale is closed
      expect(await nft.balanceOf(bob.address)).to.equal(4n);
    });
  });

  describe('allowlist mint', () => {
    async function allowlistFixture() {
      const f = await deployFixture();
      const tree = StandardMerkleTree.of([[f.alice.address], [f.bob.address]], ['address']);
      await f.nft.setAllowlistRoot(tree.root);
      await f.nft.setPhase(Phase.Allowlist);
      const proof = (addr: string) => tree.getProof([addr]);
      return { ...f, proof };
    }

    it('mints for listed wallets at the allowlist price', async () => {
      const { nft, alice, proof } = await loadFixture(allowlistFixture);
      await nft.connect(alice).allowlistMint(2, proof(alice.address), { value: AL_PRICE * 2n });
      expect(await nft.balanceOf(alice.address)).to.equal(2n);
      expect(await nft.allowlistMinted(alice.address)).to.equal(2n);
      await expect(
        nft.connect(alice).allowlistMint(1, proof(alice.address), { value: AL_PRICE }),
      ).to.be.revertedWithCustomError(nft, 'ExceedsWalletLimit');
    });

    it('rejects unlisted wallets and borrowed proofs', async () => {
      const { nft, alice, carol, proof } = await loadFixture(allowlistFixture);
      await expect(
        nft.connect(carol).allowlistMint(1, proof(alice.address), { value: AL_PRICE }),
      ).to.be.revertedWithCustomError(nft, 'NotOnAllowlist');
      await expect(nft.connect(carol).allowlistMint(1, [], { value: AL_PRICE })).to.be.revertedWithCustomError(
        nft,
        'NotOnAllowlist',
      );
    });

    it('only works during the allowlist phase', async () => {
      const { nft, alice, proof } = await loadFixture(allowlistFixture);
      await nft.setPhase(Phase.Public);
      await expect(
        nft.connect(alice).allowlistMint(1, proof(alice.address), { value: AL_PRICE }),
      ).to.be.revertedWithCustomError(nft, 'SaleNotActive');
      await expect(nft.connect(alice).mint(1, { value: AL_PRICE })).to.be.revertedWithCustomError(nft, 'WrongPayment');
    });
  });

  describe('encrypted DNA', () => {
    it('lets the holder peek privately', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      const [id] = await mintPublic(nft, alice);
      const handle = await dnaHandle(nft, id);
      const client = await cofheFor(alice);
      const dna = await client.decryptForView(handle, FheTypes.Uint64).execute();
      expect(dna).to.equal(await mockPlaintext(handle));
    });

    it('keeps the DNA hidden from everyone else', async () => {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      const [id] = await mintPublic(nft, alice);
      const handle = await dnaHandle(nft, id);
      const client = await cofheFor(bob);
      await expect(client.decryptForView(handle, FheTypes.Uint64).execute()).to.be.rejected;
      await expect(client.decryptForTx(handle).withACP().execute()).to.be.rejected;
      await expect(client.decryptForTx(handle).withoutACP().execute()).to.be.rejected;
    });

    it('hands peek access to each new holder', async () => {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      const [id] = await mintPublic(nft, alice);
      const handle = await dnaHandle(nft, id);
      const bobClient = await cofheFor(bob);
      await expect(bobClient.decryptForView(handle, FheTypes.Uint64).execute()).to.be.rejected;

      await nft.connect(alice).transferFrom(alice.address, bob.address, id);
      expect(await bobClient.decryptForView(handle, FheTypes.Uint64).execute()).to.equal(await mockPlaintext(handle));
    });
  });

  describe('reveal', () => {
    async function mintedFixture() {
      const f = await deployFixture();
      const [id] = await mintPublic(f.nft, f.alice);
      const handle = await dnaHandle(f.nft, id);
      return { ...f, id, handle };
    }

    it('publishes the DNA with the holder’s own decryption proof', async () => {
      const { nft, alice, id, handle } = await loadFixture(mintedFixture);
      const client = await cofheFor(alice);
      const { decryptedValue, signature } = await client.decryptForTx(handle).withACP().execute();
      expect(decryptedValue).to.equal(await mockPlaintext(handle));

      await expect(nft.connect(alice).reveal(id, decryptedValue, signature))
        .to.emit(nft, 'CatRevealed')
        .withArgs(id, decryptedValue)
        .and.to.emit(nft, 'MetadataUpdate')
        .withArgs(id);
      const cat = await nft.catOf(id);
      expect(cat.revealed).to.equal(true);
      expect(cat.dna).to.equal(decryptedValue);

      await expect(nft.connect(alice).reveal(id, decryptedValue, signature))
        .to.be.revertedWithCustomError(nft, 'AlreadyRevealed')
        .withArgs(id);
    });

    it('rejects a DNA that does not match the signature', async () => {
      const { nft, alice, id, handle } = await loadFixture(mintedFixture);
      const client = await cofheFor(alice);
      const { decryptedValue, signature } = await client.decryptForTx(handle).withACP().execute();
      const forged = decryptedValue ^ 0xffn; // e.g. trying to reroll the background
      await expect(nft.connect(alice).reveal(id, forged, signature))
        .to.be.revertedWithCustomError(nft, 'InvalidDecryptionProof')
        .withArgs(id);
      await expect(nft.connect(alice).reveal(id, decryptedValue, '0x' + '11'.repeat(65))).to.be.revertedWithCustomError(
        nft,
        'InvalidDecryptionProof',
      );
    });

    it('rejects a proof for another cat', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      const [a, b] = await mintPublic(nft, alice, 2);
      const client = await cofheFor(alice);
      const proofA = await client.decryptForTx(await dnaHandle(nft, a)).withACP().execute();
      await expect(nft.connect(alice).reveal(b, proofA.decryptedValue, proofA.signature)).to.be.revertedWithCustomError(
        nft,
        'InvalidDecryptionProof',
      );
    });

    it('keeps strangers out until public decryption is enabled', async () => {
      const { nft, alice, bob, id, handle } = await loadFixture(mintedFixture);
      const proof = await (await cofheFor(alice)).decryptForTx(handle).withACP().execute();
      await expect(nft.connect(bob).reveal(id, proof.decryptedValue, proof.signature))
        .to.be.revertedWithCustomError(nft, 'RevealLocked')
        .withArgs(id);
      await expect(nft.connect(bob).enablePublicDecryption(id)).to.be.revertedWithCustomError(nft, 'RevealLocked');
    });

    it('lets the holder open decryption to everyone, then anyone can finish the reveal', async () => {
      const { nft, alice, bob, id, handle } = await loadFixture(mintedFixture);
      await expect(nft.connect(alice).enablePublicDecryption(id))
        .to.emit(nft, 'PublicDecryptionEnabled')
        .withArgs(id, handle);
      expect((await nft.catOf(id)).publicDecryption).to.equal(true);

      const proof = await (await cofheFor(bob)).decryptForTx(handle).withoutACP().execute();
      await nft.connect(bob).reveal(id, proof.decryptedValue, proof.signature);
      expect((await nft.catOf(id)).dna).to.equal(await mockPlaintext(handle));
      await expect(nft.connect(alice).enablePublicDecryption(id)).to.be.revertedWithCustomError(nft, 'AlreadyRevealed');
    });

    it('opens every cat after the grand reveal time', async () => {
      const { nft, owner, alice, bob, carol } = await loadFixture(deployFixture);
      const ids = [...(await mintPublic(nft, alice, 2)), ...(await mintPublic(nft, bob, 2))];
      await expect(nft.connect(carol).enablePublicDecryptionBatch(ids)).to.be.revertedWithCustomError(nft, 'RevealLocked');
      await expect(nft.connect(carol).setGrandRevealAt(1)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );

      const at = (await time.latest()) + 3600;
      await nft.connect(owner).setGrandRevealAt(at);
      expect(await nft.grandRevealStarted()).to.equal(false);
      await time.increaseTo(at);
      expect(await nft.grandRevealStarted()).to.equal(true);

      // one cat revealed by its holder first; the batch must skip it
      const first = await (await cofheFor(alice)).decryptForTx(await dnaHandle(nft, ids[0])).withACP().execute();
      await nft.connect(alice).reveal(ids[0], first.decryptedValue, first.signature);
      await nft.connect(carol).enablePublicDecryptionBatch(ids);

      const carolClient = await cofheFor(carol);
      const rest = ids.slice(1);
      const proofs = [];
      for (const id of rest) proofs.push(await carolClient.decryptForTx(await dnaHandle(nft, id)).withoutACP().execute());
      await expect(
        nft.connect(carol).revealBatch(rest, proofs.map((p) => p.decryptedValue), [proofs[0].signature]),
      ).to.be.revertedWithCustomError(nft, 'LengthMismatch');
      await nft.connect(carol).revealBatch(
        rest,
        proofs.map((p) => p.decryptedValue),
        proofs.map((p) => p.signature),
      );
      for (const id of ids) expect((await nft.catOf(id)).revealed).to.equal(true);
    });

    it('stops granting DNA access on transfers after the reveal', async () => {
      const { nft, alice, bob, id, handle } = await loadFixture(mintedFixture);
      const proof = await (await cofheFor(alice)).decryptForTx(handle).withACP().execute();
      await nft.connect(alice).reveal(id, proof.decryptedValue, proof.signature);
      await nft.connect(alice).transferFrom(alice.address, bob.address, id);
      expect(await nft.ownerOf(id)).to.equal(bob.address);
      // the DNA is public now anyway
      expect((await nft.catOf(id)).dna).to.equal(proof.decryptedValue);
    });
  });

  describe('metadata', () => {
    it('shows an encrypted cat until the reveal, then the rendered cat', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      const [id] = await mintPublic(nft, alice);
      const handle = await dnaHandle(nft, id);

      const hidden = await nft.tokenURI(id);
      expect(hidden).to.equal(tokenUri({ tokenId: id, revealed: false, handle }));
      const hiddenJson = JSON.parse(decodeDataUri(hidden, 'data:application/json;base64,'));
      expect(hiddenJson.name).to.equal(`FheCat #${id}`);
      expect(hiddenJson.attributes).to.deep.equal([{ trait_type: 'Status', value: 'Encrypted' }]);

      const proof = await (await cofheFor(alice)).decryptForTx(handle).withACP().execute();
      await nft.connect(alice).reveal(id, proof.decryptedValue, proof.signature);

      const shown = await nft.tokenURI(id);
      expect(shown).to.equal(tokenUri({ tokenId: id, revealed: true, dna: proof.decryptedValue }));
      const json = JSON.parse(decodeDataUri(shown, 'data:application/json;base64,'));
      expect(json.attributes).to.have.length(9);
      expect(json.attributes[0]).to.deep.equal({ trait_type: 'Status', value: 'Revealed' });
      expect(decodeDataUri(json.image, 'data:image/svg+xml;base64,')).to.match(/^<svg[\s\S]*<\/svg>$/);
    });

    it('serves collection metadata', async () => {
      const { nft } = await loadFixture(deployFixture);
      const uri = await nft.contractURI();
      expect(uri).to.equal(contractUri());
      const json = JSON.parse(decodeDataUri(uri, 'data:application/json;base64,'));
      expect(json.name).to.equal('FheCat');
      expect(json.external_link).to.equal('https://x.com/FheCat');
    });

    it('reverts for tokens that do not exist', async () => {
      const { nft } = await loadFixture(deployFixture);
      await expect(nft.tokenURI(1)).to.be.revertedWithCustomError(nft, 'ERC721NonexistentToken');
    });

    it('lists a holder’s cats', async () => {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      await mintPublic(nft, alice, 2);
      await mintPublic(nft, bob, 1);
      await mintPublic(nft, alice, 1);
      const all = await nft.catsOfOwner(alice.address, 0, 100);
      expect(all.map((c) => c.tokenId)).to.deep.equal([1n, 2n, 4n]);
      const page = await nft.catsOfOwner(alice.address, 2, 3);
      expect(page.map((c) => c.tokenId)).to.deep.equal([2n]);
    });

    it('pages through all cats', async () => {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      await mintPublic(nft, alice, 2);
      await mintPublic(nft, bob, 2);
      const range = await nft.catsInRange(2, 99);
      expect(range.map((c) => [c.tokenId, c.owner])).to.deep.equal([
        [2n, alice.address],
        [3n, bob.address],
        [4n, bob.address],
      ]);
      expect(await nft.catsInRange(5, 9)).to.deep.equal([]);
      expect((await nft.catsInRange(0, 1)).length).to.equal(1);
    });
  });

  describe('admin', () => {
    it('restricts every setter to the owner', async () => {
      const { nft, renderer, alice } = await loadFixture(deployFixture);
      const as = nft.connect(alice);
      const rendererAddress = await renderer.getAddress();
      const calls = [
        () => as.setPhase(Phase.Public),
        () => as.setPrices(0, 0),
        () => as.setWalletLimits(0, 0),
        () => as.setAllowlistRoot(ethers.ZeroHash),
        () => as.setGrandRevealAt(0),
        () => as.setRenderer(rendererAddress),
        () => as.setDefaultRoyalty(alice.address, 0),
        () => as.withdraw(alice.address),
      ];
      for (const call of calls) await expect(call()).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
    });

    it('swaps the renderer and refreshes all metadata', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      await mintPublic(nft, alice, 3);
      const next = await ethers.deployContract('FheCatRenderer');
      await expect(nft.setRenderer(await next.getAddress()))
        .to.emit(nft, 'BatchMetadataUpdate')
        .withArgs(1n, 3n);
      expect(await nft.renderer()).to.equal(await next.getAddress());
      await expect(nft.setRenderer(ethers.ZeroAddress)).to.be.revertedWithCustomError(nft, 'ZeroAddress');
    });

    it('withdraws mint proceeds', async () => {
      const { nft, alice, treasury } = await loadFixture(deployFixture);
      await mintPublic(nft, alice, 4);
      await expect(nft.withdraw(treasury.address)).to.changeEtherBalances([nft, treasury], [-PRICE * 4n, PRICE * 4n]);
    });

    it('transfers ownership in two steps', async () => {
      const { nft, owner, alice } = await loadFixture(deployFixture);
      await nft.transferOwnership(alice.address);
      expect(await nft.owner()).to.equal(owner.address);
      await nft.connect(alice).acceptOwnership();
      expect(await nft.owner()).to.equal(alice.address);
    });
  });
});
