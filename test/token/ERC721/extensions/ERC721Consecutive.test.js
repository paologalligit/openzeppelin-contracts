const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { sum } = require('../../../helpers/math');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

const ERC721ConsecutiveMock = artifacts.require('$ERC721ConsecutiveMock');
const ERC721ConsecutiveEnumerableMock = artifacts.require('$ERC721ConsecutiveEnumerableMock');
const ERC721ConsecutiveNoConstructorMintMock = artifacts.require('$ERC721ConsecutiveNoConstructorMintMock');
// TODO: this strange errrors "The transaction receipt didn't contain a contract address."
contract('ERC721Consecutive', function (accounts) {
  const [user1, user2, user3, receiver] = accounts;

  const name = 'Non Fungible Token';
  const symbol = 'NFT';
  const batches = [
    { receiver: user1, amount: 0 },
    { receiver: user1, amount: 1 },
    { receiver: user1, amount: 2 },
    { receiver: user2, amount: 5 },
    { receiver: user3, amount: 0 },
    { receiver: user1, amount: 7 },
  ];
  const delegates = [user1, user3];

  for (const offset of [0, 1, 42]) {
    describe(`with offset ${offset}`, function () {
      beforeEach(async function () {
        this.token = await ERC721ConsecutiveMock.new(
          name,
          symbol,
          offset,
          delegates,
          batches.map(({ receiver }) => receiver),
          batches.map(({ amount }) => amount),
        );
      });

      describe('minting during construction', function () {
        it('events are emitted at construction', async function () {
          let first = offset;

          for (const batch of batches) {
            if (batch.amount > 0) {
              await expectEvent.inConstruction(this.token, 'ConsecutiveTransfer', {
                fromTokenId: web3.utils.toBN(first),
                toTokenId: web3.utils.toBN(first + batch.amount - 1),
                fromAddress: constants.ZERO_ADDRESS,
                toAddress: batch.receiver,
              });
            } else {
              // expectEvent.notEmitted.inConstruction only looks at event name, and doesn't check the parameters
            }
            first += batch.amount;
          }
        });

        it('ownership is set', async function () {
          const owners = [
            ...Array(offset).fill(constants.ZERO_ADDRESS),
            ...batches.flatMap(({ receiver, amount }) => Array(amount).fill(receiver)),
          ];

          for (const tokenId in owners) {
            if (owners[tokenId] != constants.ZERO_ADDRESS) {
              expect(await this.token.ownerOf(tokenId)).to.be.equal(owners[tokenId]);
            }
          }
        });

        it('balance & voting power are set', async function () {
          for (const account of accounts) {
            const balance = sum(...batches.filter(({ receiver }) => receiver === account).map(({ amount }) => amount));

            expect(await this.token.balanceOf(account)).to.be.bignumber.equal(web3.utils.toBN(balance));

            // If not delegated at construction, check before + do delegation
            if (!delegates.includes(account)) {
              expect(await this.token.getVotes(account)).to.be.bignumber.equal(web3.utils.toBN(0));

              await this.token.delegate(account, { from: account });
            }

            // At this point all accounts should have delegated
            expect(await this.token.getVotes(account)).to.be.bignumber.equal(web3.utils.toBN(balance));
          }
        });

        it('reverts on consecutive minting to the zero address', async function () {
          await expectRevert(
            ERC721ConsecutiveMock.new(name, symbol, offset, delegates, [ZERO_ADDRESS], [10]),
            "The transaction receipt didn't contain a contract address."
          );
        });
      });

      describe('minting after construction', function () {
        it('consecutive minting is not possible after construction', async function () {
          await expectRevert.unspecified(this.token.$_mintConsecutive(user1, 10));
        });

        it('simple minting is possible after construction', async function () {
          const tokenId = sum(...batches.map(b => b.amount)) + offset;

          await expectRevert.unspecified(this.token.ownerOf(tokenId));

          expectEvent(await this.token.$_mint(user1, tokenId), 'Transfer', {
            from: constants.ZERO_ADDRESS,
            to: user1,
            tokenId: tokenId.toString(),
          });
        });

        it('cannot mint a token that has been batched minted', async function () {
          const tokenId = sum(...batches.map(b => b.amount)) + offset - 1;

          expect(await this.token.ownerOf(tokenId)).to.be.not.equal(constants.ZERO_ADDRESS);

          await expectRevert.unspecified(this.token.$_mint(user1, tokenId));
        });
      });

      describe('ERC721 behavior', function () {
        const tokenId = web3.utils.toBN(offset + 1);

        it('core takes over ownership on transfer', async function () {
          await this.token.transferFrom(user1, receiver, tokenId, { from: user1 });

          expect(await this.token.ownerOf(tokenId)).to.be.equal(receiver);
        });

        it('tokens can be burned and re-minted #1', async function () {
          expectEvent(await this.token.$_burn(tokenId, { from: user1 }), 'Transfer', {
            from: user1,
            to: constants.ZERO_ADDRESS,
            tokenId,
          });

          await expectRevert.unspecified(this.token.ownerOf(tokenId));

          expectEvent(await this.token.$_mint(user2, tokenId), 'Transfer', {
            from: constants.ZERO_ADDRESS,
            to: user2,
            tokenId,
          });

          expect(await this.token.ownerOf(tokenId)).to.be.equal(user2);
        });

        it('tokens can be burned and re-minted #2', async function () {
          const tokenId = web3.utils.toBN(sum(...batches.map(({ amount }) => amount)) + offset);

          await expectRevert.unspecified(this.token.ownerOf(tokenId));

          // mint
          await this.token.$_mint(user1, tokenId);

          expect(await this.token.ownerOf(tokenId), user1);

          // burn
          expectEvent(await this.token.$_burn(tokenId, { from: user1 }), 'Transfer', {
            from: user1,
            to: constants.ZERO_ADDRESS,
            tokenId,
          });

          await expectRevert.unspecified(this.token.ownerOf(tokenId));

          // re-mint
          expectEvent(await this.token.$_mint(user2, tokenId), 'Transfer', {
            from: constants.ZERO_ADDRESS,
            to: user2,
            tokenId,
          });

          expect(await this.token.ownerOf(tokenId), user2);
        });
      });
    });
  }

  describe('invalid use', function () {
    it('cannot mint a batch larger than 5000', async function () {
      await expectRevert(
        ERC721ConsecutiveMock.new(name, symbol, 0, [], [user1], ['5001']),
        "The transaction receipt didn't contain a contract address."
      );
    });

    it('cannot use single minting during construction', async function () {
      await expectRevert(
        ERC721ConsecutiveNoConstructorMintMock.new(name, symbol),
        "The transaction receipt didn't contain a contract address."
      );
    });

    it('cannot use single minting during construction', async function () {
      await expectRevert(
        ERC721ConsecutiveNoConstructorMintMock.new(name, symbol),
        "The transaction receipt didn't contain a contract address."
      );
    });

    it('consecutive mint not compatible with enumerability', async function () {
      await expectRevert(
        ERC721ConsecutiveEnumerableMock.new(
          name,
          symbol,
          batches.map(({ receiver }) => receiver),
          batches.map(({ amount }) => amount),
        ),
        "The transaction receipt didn't contain a contract address."
      );
    });
  });
});
