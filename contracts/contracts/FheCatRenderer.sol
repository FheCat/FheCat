// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IFheCatRenderer} from "./interfaces/IFheCatRenderer.sol";
import {FheCatArt as Art} from "./art/FheCatArt.sol";

/// @title FheCatRenderer
/// @notice Fully on-chain SVG and JSON metadata for FheCat.
/// @dev Output is byte-identical to the TypeScript reference renderer in /art (checked by the tests).
///      SVGs are written into one preallocated buffer, so rendering stays linear in output size.
contract FheCatRenderer is IFheCatRenderer {
    using Strings for uint256;

    /// @dev Art tables, copied out of code once per render.
    struct Ctx {
        bytes colors;
        bytes layers;
        bytes offsets;
        bytes optionLayers;
        uint256[5] fur;
    }

    bytes16 private constant HEX = "0123456789abcdef";

    // ---------------------------------------------------------------------
    // IFheCatRenderer
    // ---------------------------------------------------------------------

    function tokenURI(uint256 tokenId, bool revealed, uint64 dna, bytes32 dnaHandle)
        external
        pure
        returns (string memory)
    {
        string memory name = string.concat(Art.COLLECTION_NAME, " #", tokenId.toString());
        bytes memory json;
        if (revealed) {
            json = abi.encodePacked(
                '{"name":"',
                name,
                '","description":"',
                Art.REVEALED_DESCRIPTION,
                '","image":"',
                _svgDataUri(catSvg(dna)),
                '","attributes":[{"trait_type":"Status","value":"Revealed"}',
                _attributes(dna),
                "]}"
            );
        } else {
            json = abi.encodePacked(
                '{"name":"',
                name,
                '","description":"',
                Art.ENCRYPTED_DESCRIPTION,
                '","image":"',
                _svgDataUri(encryptedSvg(dnaHandle)),
                '","attributes":[{"trait_type":"Status","value":"Encrypted"}]}'
            );
        }
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function contractURI() external pure returns (string memory) {
        bytes memory json = abi.encodePacked(
            '{"name":"',
            Art.COLLECTION_NAME,
            '","description":"',
            Art.COLLECTION_DESCRIPTION,
            '","image":"',
            _svgDataUri(motifSvg()),
            '","external_link":"',
            Art.EXTERNAL_LINK,
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    // ---------------------------------------------------------------------
    // Traits
    // ---------------------------------------------------------------------

    /// @notice Option index of every trait. DNA byte i (least significant first) picks trait i.
    function traitIndices(uint64 dna) public pure returns (uint256[8] memory idx) {
        bytes memory counts = Art.OPTION_COUNTS;
        bytes memory weights = Art.WEIGHTS;
        uint256 base;
        for (uint256 t; t < Art.TRAIT_COUNT; ++t) {
            uint256 roll = (uint256(dna) >> (8 * t)) & 0xff;
            uint256 n = uint8(counts[t]);
            uint256 acc;
            uint256 k;
            for (; k < n; ++k) {
                acc += uint8(weights[base + k]);
                if (roll < acc) break;
            }
            idx[t] = k;
            base += n;
        }
    }

    /// @notice Human-readable traits, e.g. labels[1] = "Fur", values[1] = "Ginger".
    function traits(uint64 dna) external pure returns (string[8] memory labels, string[8] memory values) {
        uint256[8] memory idx = traitIndices(dna);
        uint256[8] memory base = _optionBases();
        for (uint256 t; t < Art.TRAIT_COUNT; ++t) {
            labels[t] = string(_name(t));
            values[t] = string(_name(Art.TRAIT_COUNT + base[t] + idx[t]));
        }
    }

    // ---------------------------------------------------------------------
    // SVG
    // ---------------------------------------------------------------------

    function catSvg(uint64 dna) public pure returns (string memory) {
        uint256[8] memory idx = traitIndices(dna);
        uint256[8] memory base = _optionBases();
        Ctx memory ctx = _ctx(idx[1]);

        (bytes memory buf, uint256 ptr) = _alloc(Art.MAX_CAT_SVG_BYTES);
        uint256 start = ptr;
        ptr = _put(ptr, bytes(Art.SVG_OPEN));
        ptr = _putShort(ptr, '<rect width="32" height="32" ', 29);
        ptr = _putShort(ptr, 'fill="#', 7);
        ptr = _putColor(ptr, ctx.colors, uint8(bytes(Art.BACKGROUND_FILLS)[idx[0]]));
        ptr = _putShort(ptr, '"/>', 3);

        // Paint order: background decor, aura, body, head, pattern, eyes, mouth, accessory, headwear.
        ptr = _putOption(ptr, ctx, base, idx, 0);
        ptr = _putOption(ptr, ctx, base, idx, 7);
        ptr = _putLayer(ptr, ctx, Art.BODY_LAYER);
        ptr = _putLayer(ptr, ctx, Art.HEAD_LAYER);
        ptr = _putOption(ptr, ctx, base, idx, 2);
        ptr = _putOption(ptr, ctx, base, idx, 3);
        ptr = _putOption(ptr, ctx, base, idx, 4);
        ptr = _putOption(ptr, ctx, base, idx, 6);
        ptr = _putOption(ptr, ctx, base, idx, 5);

        ptr = _put(ptr, bytes(Art.SVG_CLOSE));
        return _seal(buf, start, ptr, Art.MAX_CAT_SVG_BYTES);
    }

    /// @notice The logo mark plus a barcode of the ciphertext handle, unique per token.
    function encryptedSvg(bytes32 dnaHandle) public pure returns (string memory) {
        Ctx memory ctx = _ctx(0);
        (bytes memory buf, uint256 ptr) = _alloc(Art.MAX_ENCRYPTED_SVG_BYTES);
        uint256 start = ptr;
        ptr = _putMotif(ptr, ctx);
        ptr = _putBarcode(ptr, dnaHandle);
        ptr = _put(ptr, bytes(Art.SVG_CLOSE));
        return _seal(buf, start, ptr, Art.MAX_ENCRYPTED_SVG_BYTES);
    }

    /// @notice The collection image.
    function motifSvg() public pure returns (string memory) {
        Ctx memory ctx = _ctx(0);
        (bytes memory buf, uint256 ptr) = _alloc(Art.MAX_ENCRYPTED_SVG_BYTES);
        uint256 start = ptr;
        ptr = _putMotif(ptr, ctx);
        ptr = _put(ptr, bytes(Art.SVG_CLOSE));
        return _seal(buf, start, ptr, Art.MAX_ENCRYPTED_SVG_BYTES);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _attributes(uint64 dna) private pure returns (bytes memory out) {
        uint256[8] memory idx = traitIndices(dna);
        uint256[8] memory base = _optionBases();
        for (uint256 t; t < Art.TRAIT_COUNT; ++t) {
            out = abi.encodePacked(
                out,
                ',{"trait_type":"',
                _name(t),
                '","value":"',
                _name(Art.TRAIT_COUNT + base[t] + idx[t]),
                '"}'
            );
        }
    }

    function _svgDataUri(string memory svg) private pure returns (string memory) {
        return string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));
    }

    function _ctx(uint256 fur) private pure returns (Ctx memory ctx) {
        ctx.colors = Art.COLORS;
        ctx.layers = Art.LAYERS;
        ctx.offsets = Art.LAYER_OFFSETS;
        ctx.optionLayers = Art.OPTION_LAYERS;
        bytes memory palettes = Art.FUR_PALETTES;
        for (uint256 r; r < Art.ROLE_COUNT; ++r) {
            ctx.fur[r] = uint8(palettes[fur * Art.ROLE_COUNT + r]);
        }
    }

    /// @dev Index of each trait's first option in the flat option tables.
    function _optionBases() private pure returns (uint256[8] memory base) {
        bytes memory counts = Art.OPTION_COUNTS;
        for (uint256 t = 1; t < Art.TRAIT_COUNT; ++t) {
            base[t] = base[t - 1] + uint8(counts[t - 1]);
        }
    }

    function _name(uint256 i) private pure returns (bytes memory out) {
        bytes memory names = Art.NAMES;
        bytes memory offsets = Art.NAME_OFFSETS;
        uint256 from = _u16(offsets, i);
        uint256 to = _u16(offsets, i + 1);
        out = new bytes(to - from);
        for (uint256 j; j < out.length; ++j) {
            out[j] = names[from + j];
        }
    }

    function _u16(bytes memory data, uint256 i) private pure returns (uint256) {
        return (uint256(uint8(data[2 * i])) << 8) | uint8(data[2 * i + 1]);
    }

    function _putOption(uint256 ptr, Ctx memory ctx, uint256[8] memory base, uint256[8] memory idx, uint256 t)
        private
        pure
        returns (uint256)
    {
        uint256 layer = uint8(ctx.optionLayers[base[t] + idx[t]]);
        return layer == Art.NO_LAYER ? ptr : _putLayer(ptr, ctx, layer);
    }

    function _putMotif(uint256 ptr, Ctx memory ctx) private pure returns (uint256) {
        ptr = _put(ptr, bytes(Art.SVG_OPEN));
        ptr = _putShort(ptr, '<rect width="32" height="32" ', 29);
        ptr = _putShort(ptr, 'fill="#', 7);
        ptr = _put(ptr, bytes(Art.ENCRYPTED_FILL));
        ptr = _putShort(ptr, '"/>', 3);
        return _putLayer(ptr, ctx, Art.MOTIF_LAYER);
    }

    /// @dev Layer = groups of [colour, rectCount, (x, y, w, h) * rectCount]; one <path> per group.
    function _putLayer(uint256 ptr, Ctx memory ctx, uint256 layer) private pure returns (uint256) {
        bytes memory data = ctx.layers;
        uint256 p = _u16(ctx.offsets, layer);
        uint256 end = _u16(ctx.offsets, layer + 1);
        while (p < end) {
            uint256 color = uint8(data[p]);
            uint256 n = uint8(data[p + 1]);
            p += 2;
            ptr = _putShort(ptr, '<path fill="#', 13);
            ptr = _putColor(ptr, ctx.colors, color < Art.ROLE_COUNT ? ctx.fur[color] : color - Art.ROLE_COUNT);
            ptr = _putShort(ptr, '" d="', 5);
            for (uint256 i; i < n; ++i) {
                ptr = _putRect(ptr, uint8(data[p]), uint8(data[p + 1]), uint8(data[p + 2]), uint8(data[p + 3]));
                p += 4;
            }
            ptr = _putShort(ptr, '"/>', 3);
        }
        return ptr;
    }

    /// @dev Two 20-bit rows from the top of the handle: runs of 0s in one path, runs of 1s in another.
    function _putBarcode(uint256 ptr, bytes32 handle) private pure returns (uint256) {
        for (uint256 pass; pass < 2; ++pass) {
            ptr = _putShort(ptr, '<path fill="#', 13);
            ptr = _put(ptr, bytes(pass == 0 ? Art.BARCODE_OFF : Art.BARCODE_ON));
            ptr = _putShort(ptr, '" d="', 5);
            for (uint256 row; row < 2; ++row) {
                uint256 col;
                while (col < 20) {
                    uint256 bit = _bit(handle, row * 20 + col);
                    uint256 w = 1;
                    while (col + w < 20 && _bit(handle, row * 20 + col + w) == bit) ++w;
                    if (bit == pass) ptr = _putRect(ptr, 6 + col, 27 + row, w, 1);
                    col += w;
                }
            }
            ptr = _putShort(ptr, '"/>', 3);
        }
        return ptr;
    }

    function _bit(bytes32 handle, uint256 i) private pure returns (uint256) {
        return (uint256(handle) >> (255 - i)) & 1;
    }

    // --- raw buffer writes ---------------------------------------------------

    /// @dev Allocates `cap` bytes plus one word of slack for the word-sized writes of _putShort.
    function _alloc(uint256 cap) private pure returns (bytes memory buf, uint256 ptr) {
        buf = new bytes(cap + 32);
        assembly {
            ptr := add(buf, 0x20)
        }
    }

    function _seal(bytes memory buf, uint256 start, uint256 ptr, uint256 cap) private pure returns (string memory) {
        uint256 len = ptr - start;
        require(len <= cap, "FheCatRenderer: buffer overflow");
        assembly {
            mstore(buf, len)
        }
        return string(buf);
    }

    function _put(uint256 ptr, bytes memory s) private pure returns (uint256) {
        assembly {
            let n := mload(s)
            mcopy(ptr, add(s, 0x20), n)
            ptr := add(ptr, n)
        }
        return ptr;
    }

    /// @dev Writes the first `len` (<= 32) bytes of `word`.
    function _putShort(uint256 ptr, bytes32 word, uint256 len) private pure returns (uint256) {
        assembly {
            mstore(ptr, word)
            ptr := add(ptr, len)
        }
        return ptr;
    }

    function _putColor(uint256 ptr, bytes memory colors, uint256 i) private pure returns (uint256) {
        for (uint256 j; j < 3; ++j) {
            uint8 b = uint8(colors[3 * i + j]);
            bytes1 hi = HEX[b >> 4];
            bytes1 lo = HEX[b & 0x0f];
            assembly {
                mstore8(ptr, shr(248, hi))
                mstore8(add(ptr, 1), shr(248, lo))
                ptr := add(ptr, 2)
            }
        }
        return ptr;
    }

    /// @dev "M{x} {y}h{w}v{h}h-{w}z" for coordinates below 100.
    function _putRect(uint256 ptr, uint256 x, uint256 y, uint256 w, uint256 h) private pure returns (uint256) {
        ptr = _putChar(ptr, "M");
        ptr = _putNum(ptr, x);
        ptr = _putChar(ptr, " ");
        ptr = _putNum(ptr, y);
        ptr = _putChar(ptr, "h");
        ptr = _putNum(ptr, w);
        ptr = _putChar(ptr, "v");
        ptr = _putNum(ptr, h);
        ptr = _putShort(ptr, "h-", 2);
        ptr = _putNum(ptr, w);
        return _putChar(ptr, "z");
    }

    function _putChar(uint256 ptr, bytes1 c) private pure returns (uint256) {
        assembly {
            mstore8(ptr, shr(248, c))
            ptr := add(ptr, 1)
        }
        return ptr;
    }

    function _putNum(uint256 ptr, uint256 v) private pure returns (uint256) {
        assembly {
            if gt(v, 9) {
                mstore8(ptr, add(48, div(v, 10)))
                ptr := add(ptr, 1)
            }
            mstore8(ptr, add(48, mod(v, 10)))
            ptr := add(ptr, 1)
        }
        return ptr;
    }
}
