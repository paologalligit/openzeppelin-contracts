const { time, constants, expectRevert } = require('@openzeppelin/test-helpers');
const {
  shouldBehaveLikeAccessControl,
  shouldBehaveLikeAccessControlDefaultAdminRules,
} = require('../AccessControl.behavior.js');

const AccessControlDefaultAdminRules = artifacts.require('$AccessControlDefaultAdminRules');
// TODO: OnlyHardhatNetworkError
contract('AccessControlDefaultAdminRules', function (accounts) {
  const delay = web3.utils.toBN(time.duration.hours(10));

  beforeEach(async function () {
    this.accessControl = await AccessControlDefaultAdminRules.new(delay, accounts[0], { from: accounts[0] });
  });

  it('initial admin not zero', async function () {
    await expectRevert(
      AccessControlDefaultAdminRules.new(delay, constants.ZERO_ADDRESS),
      "The transaction receipt didn't contain a contract address."
    );
  });

  shouldBehaveLikeAccessControl(...accounts);
  shouldBehaveLikeAccessControlDefaultAdminRules(delay, ...accounts);
});
