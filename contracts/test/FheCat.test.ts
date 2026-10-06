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
  State,
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

  describe('the box', () => {
    async function mintedFixture() {
      const f = await deployFixture();
      const [id] = await mintPublic(f.nft, f.alice);
      const handle = await dnaHandle(f.nft, id);
      return { ...f, id, handle };
    }

    it('is born unopened: no wallet can decrypt it, not even the holder or the team', async () => {
      const { nft, owner, alice, bob, id, handle } = await loadFixture(mintedFixture);
      expect(await nft.stateOf(id)).to.equal(State.Unopened);
      for (const who of [alice, bob, owner]) {
        const client = await cofheFor(who);
        await expect(client.decryptForView(handle, FheTypes.Uint64).execute(), who.address).to.be.rejected;
        await expect(client.decryptForTx(handle).withACP().execute(), who.address).to.be.rejected;
        await expect(client.decryptForTx(handle).withoutACP().execute(), who.address).to.be.rejected;
      }
    });

    it('lets only the holder peek, privately, and marks the cat for good', async () => {
      const { nft, owner, alice, bob, id, handle } = await loadFixture(mintedFixture);
      await expect(nft.connect(bob).peek(id)).to.be.revertedWithCustomError(nft, 'NotHolder').withArgs(id);
      await expect(nft.connect(owner).peek(id)).to.be.revertedWithCustomError(nft, 'NotHolder').withArgs(id);

      await expect(nft.connect(alice).peek(id))
        .to.emit(nft, 'CatPeeked')
        .withArgs(id, alice.address)
        .and.to.emit(nft, 'MetadataUpdate')
        .withArgs(id);
      expect(await nft.stateOf(id)).to.equal(State.Peeked);
      const seen = await (await cofheFor(alice)).decryptForView(handle, FheTypes.Uint64).execute();
      expect(seen).to.equal(await mockPlaintext(handle));
      await expect((await cofheFor(bob)).decryptForView(handle, FheTypes.Uint64).execute()).to.be.rejected;

      // a second peek is allowed but changes nothing on the metadata
      await expect(nft.connect(alice).peek(id)).to.emit(nft, 'CatPeeked').and.not.to.emit(nft, 'MetadataUpdate');
    });

    it('keeps the peeked flag after a sale; the buyer must peek on their own', async () => {
      const { nft, alice, bob, id, handle } = await loadFixture(mintedFixture);
      await nft.connect(alice).peek(id);
      await nft.connect(alice).transferFrom(alice.address, bob.address, id);
      expect(await nft.stateOf(id)).to.equal(State.Peeked);
      const bobClient = await cofheFor(bob);
      await expect(bobClient.decryptForView(handle, FheTypes.Uint64).execute()).to.be.rejected;
      await nft.connect(bob).peek(id);
      expect(await bobClient.decryptForView(handle, FheTypes.Uint64).execute()).to.equal(await mockPlaintext(handle));
    });

    it('stays unopened through sales when nobody peeks', async () => {
      const { nft, alice, bob, carol, id, handle } = await loadFixture(mintedFixture);
      await nft.connect(alice).transferFrom(alice.address, bob.address, id);
      await nft.connect(bob).transferFrom(bob.address, carol.address, id);
      expect(await nft.stateOf(id)).to.equal(State.Unopened);
      for (const who of [alice, bob, carol]) {
        await expect((await cofheFor(who)).decryptForView(handle, FheTypes.Uint64).execute()).to.be.rejected;
      }
    });

    it('opens only by its holder, then anyone can finish the reveal', async () => {
      const { nft, owner, alice, bob, id, handle } = await loadFixture(mintedFixture);
      await expect(nft.connect(owner).open(id)).to.be.revertedWithCustomError(nft, 'NotHolder');
      await expect(nft.connect(alice).open(id))
        .to.emit(nft, 'CatOpened')
        .withArgs(id, handle)
        .and.to.emit(nft, 'MetadataUpdate')
        .withArgs(id);
      expect(await nft.stateOf(id)).to.equal(State.Opened);
      await expect(nft.connect(alice).open(id)).to.be.revertedWithCustomError(nft, 'AlreadyOpened').withArgs(id);
      await expect(nft.connect(alice).peek(id)).to.be.revertedWithCustomError(nft, 'AlreadyOpened').withArgs(id);

      const proof = await (await cofheFor(bob)).decryptForTx(handle).withoutACP().execute();
      await expect(nft.connect(bob).reveal(id, proof.decryptedValue, proof.signature))
        .to.emit(nft, 'CatRevealed')
        .withArgs(id, proof.decryptedValue);
      const cat = await nft.catOf(id);
      expect(cat.state).to.equal(State.Revealed);
      expect(cat.dna).to.equal(await mockPlaintext(handle));
      expect([cat.peeked, cat.opened, cat.revealed]).to.deep.equal([false, true, true]);
    });

    it('can be revealed directly by a holder who peeked, with their own proof', async () => {
      const { nft, alice, id, handle } = await loadFixture(mintedFixture);
      await nft.connect(alice).peek(id);
      const { decryptedValue, signature } = await (await cofheFor(alice)).decryptForTx(handle).withACP().execute();
      await expect(nft.connect(alice).reveal(id, decryptedValue, signature))
        .to.emit(nft, 'CatRevealed')
        .withArgs(id, decryptedValue)
        .and.to.emit(nft, 'MetadataUpdate')
        .withArgs(id);
      expect(await nft.stateOf(id)).to.equal(State.Revealed);
      await expect(nft.connect(alice).reveal(id, decryptedValue, signature))
        .to.be.revertedWithCustomError(nft, 'AlreadyRevealed')
        .withArgs(id);
      await expect(nft.connect(alice).peek(id)).to.be.revertedWithCustomError(nft, 'AlreadyRevealed');
      await expect(nft.connect(alice).open(id)).to.be.revertedWithCustomError(nft, 'AlreadyRevealed');
    });

    it('does not let a former holder who peeked reveal a cat they sold', async () => {
      const { nft, alice, bob, id, handle } = await loadFixture(mintedFixture);
      await nft.connect(alice).peek(id);
      const proof = await (await cofheFor(alice)).decryptForTx(handle).withACP().execute();
      await nft.connect(alice).transferFrom(alice.address, bob.address, id);
      await expect(nft.connect(alice).reveal(id, proof.decryptedValue, proof.signature))
        .to.be.revertedWithCustomError(nft, 'RevealLocked')
        .withArgs(id);
    });

    it('rejects a DNA that does not match the signature, and proofs for other cats', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      const [a, b] = await mintPublic(nft, alice, 2);
      await nft.connect(alice).peek(a);
      await nft.connect(alice).peek(b);
      const client = await cofheFor(alice);
      const proofA = await client.decryptForTx(await dnaHandle(nft, a)).withACP().execute();
      const forged = proofA.decryptedValue ^ 0xffn; // e.g. trying to reroll the background
      await expect(nft.connect(alice).reveal(a, forged, proofA.signature))
        .to.be.revertedWithCustomError(nft, 'InvalidDecryptionProof')
        .withArgs(a);
      await expect(nft.connect(alice).reveal(a, proofA.decryptedValue, '0x' + '11'.repeat(65))).to.be.revertedWithCustomError(
        nft,
        'InvalidDecryptionProof',
      );
      await expect(nft.connect(alice).reveal(b, proofA.decryptedValue, proofA.signature)).to.be.revertedWithCustomError(
        nft,
        'InvalidDecryptionProof',
      );
    });

    it('never forces a reveal: nobody but the holder can open a cat, at any time', async () => {
      const { nft, owner, alice, bob, id } = await loadFixture(mintedFixture);
      await time.increase(10 * 365 * 24 * 3600);
      for (const who of [owner, bob]) {
        await expect(nft.connect(who).open(id)).to.be.revertedWithCustomError(nft, 'NotHolder');
        await expect(nft.connect(who).peek(id)).to.be.revertedWithCustomError(nft, 'NotHolder');
      }
      expect(await nft.stateOf(id)).to.equal(State.Unopened);
      expect(nft.interface.getFunction('setGrandRevealAt' as never)).to.equal(null);
      expect((await nft.catOf(id)).owner).to.equal(alice.address);
    });

    it('reveals in batches with matching lengths', async () => {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      const ids = await mintPublic(nft, alice, 3);
      for (const id of ids) await nft.connect(alice).open(id);
      const client = await cofheFor(bob);
      const proofs = [];
      for (const id of ids) proofs.push(await client.decryptForTx(await dnaHandle(nft, id)).withoutACP().execute());
      await expect(
        nft.connect(bob).revealBatch(ids, proofs.map((p) => p.decryptedValue), [proofs[0].signature]),
      ).to.be.revertedWithCustomError(nft, 'LengthMismatch');
      await nft.connect(bob).revealBatch(
        ids,
        proofs.map((p) => p.decryptedValue),
        proofs.map((p) => p.signature),
      );
      for (const id of ids) expect(await nft.stateOf(id)).to.equal(State.Revealed);
    });
  });

  describe('arena hook', () => {
    it('lets a holder allow the arena to compute on their cat, and nobody else', async () => {
      const { nft, owner, alice, bob } = await loadFixture(deployFixture);
      const [id] = await mintPublic(nft, alice);
      const handle = await dnaHandle(nft, id);
      const probe = await ethers.deployContract('ArenaProbe');
      const probeAddress = await probe.getAddress();

      await expect(nft.connect(alice).enterArena(id)).to.be.revertedWithCustomError(nft, 'NoArena');
      await expect(nft.connect(alice).setArena(probeAddress)).to.be.revertedWithCustomError(
        nft,
        'OwnableUnauthorizedAccount',
      );
      await expect(nft.connect(owner).setArena(probeAddress)).to.emit(nft, 'ArenaChanged').withArgs(probeAddress);

      // before the holder opts in, the arena cannot touch the ciphertext
      await expect(probe.touch(handle)).to.be.reverted;
      await expect(nft.connect(bob).enterArena(id)).to.be.revertedWithCustomError(nft, 'NotHolder');
      await expect(nft.connect(alice).enterArena(id)).to.emit(nft, 'CatEnteredArena').withArgs(id, probeAddress);
      await expect(probe.touch(handle)).not.to.be.reverted;

      // entering the arena gives no wallet a way in: the cat is still unopened
      expect(await nft.stateOf(id)).to.equal(State.Unopened);
      await expect((await cofheFor(alice)).decryptForView(handle, FheTypes.Uint64).execute()).to.be.rejected;
    });
  });

  describe('metadata', () => {
    it('follows the box through every state, then shows the rendered cat', async () => {
      const { nft, alice } = await loadFixture(deployFixture);
      const [id] = await mintPublic(nft, alice);
      const handle = await dnaHandle(nft, id);
      const json = async () => JSON.parse(decodeDataUri(await nft.tokenURI(id), 'data:application/json;base64,'));

      expect(await nft.tokenURI(id)).to.equal(tokenUri({ tokenId: id, state: 0, handle }));
      expect((await json()).name).to.equal(`FheCat #${id}`);
      expect((await json()).attributes).to.deep.equal([{ trait_type: 'Status', value: 'Unopened' }]);

      await nft.connect(alice).peek(id);
      expect(await nft.tokenURI(id)).to.equal(tokenUri({ tokenId: id, state: 1, handle }));
      expect((await json()).attributes).to.deep.equal([{ trait_type: 'Status', value: 'Peeked' }]);

      await nft.connect(alice).open(id);
      expect(await nft.tokenURI(id)).to.equal(tokenUri({ tokenId: id, state: 2, handle }));
      expect((await json()).attributes).to.deep.equal([{ trait_type: 'Status', value: 'Opened' }]);

      const proof = await (await cofheFor(alice)).decryptForTx(handle).withoutACP().execute();
      await nft.connect(alice).reveal(id, proof.decryptedValue, proof.signature);
      expect(await nft.tokenURI(id)).to.equal(tokenUri({ tokenId: id, state: 3, dna: proof.decryptedValue }));
      const shown = await json();
      expect(shown.attributes).to.have.length(9);
      expect(shown.attributes[0]).to.deep.equal({ trait_type: 'Status', value: 'Revealed' });
      expect(decodeDataUri(shown.image, 'data:image/svg+xml;base64,')).to.match(/^<svg[\s\S]*<\/svg>$/);
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
        () => as.setArena(alice.address),
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
