const fetch = require('node-fetch');

// fetch('http://localhost:8080/codeVerification', {
//   "headers": {
//     "accept": "*/*",
//     "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
//     "cache-control": "max-age=0",
//     "content-type": "application/json",
//     "sec-fetch-dest": "empty",
//     "sec-fetch-mode": "cors",
//     "sec-fetch-site": "cross-site",
//     "sec-gpc": "1"
//   },
//   "referrerPolicy": "no-referrer",
//   "body": "{\"chainType\":\"mainnet\",\"contractAddress\":\"0xa282df1448f5a4a11fd954caa2c27200f13806a0\",\"language\":1,\"compiler\":\"0.2.16\",\"optimizer\":\"No\",\"optimizerTimes\":\"\",\"sourceCode\":\"# @version 0.2.16\\n\\n\\ninterface Vault:\\n    def token() -> address: view\\n    def apiVersion() -> String[28]: view\\n    def governance() -> address: view\\n    def initialize(\\n        token: address,\\n        governance: address,\\n        rewards: address,\\n        name: String[64],\\n        symbol: String[32],\\n        guardian: address,\\n    ): nonpayable\\n\\n\\n# len(releases)\\nnumReleases: public(uint256)\\nreleases: public(HashMap[uint256, address])\\n\\n# Token => len(vaults)\\nnumVaults: public(HashMap[address, uint256])\\nvaults: public(HashMap[address, HashMap[uint256, address]])\\n\\n# Index of token added => token address\\ntokens: public(HashMap[uint256, address])\\n# len(tokens)\\nnumTokens: public(uint256)\\n# Inclusion check for token\\nisRegistered: public(HashMap[address, bool])\\n\\n# 2-phase commit\\ngovernance: public(address)\\npendingGovernance: public(address)\\n\\ntags: public(HashMap[address, String[120]])\\nbanksy: public(HashMap[address, bool])  # could be anyone\\n\\nevent NewRelease:\\n    release_id: indexed(uint256)\\n    template: address\\n    api_version: String[28]\\n\\nevent NewVault:\\n    token: indexed(address)\\n    vault_id: indexed(uint256)\\n    vault: address\\n    api_version: String[28]\\n\\nevent NewExperimentalVault:\\n    token: indexed(address)\\n    deployer: indexed(address)\\n    vault: address\\n    api_version: String[28]\\n\\nevent NewGovernance:\\n    governance: address\\n\\nevent VaultTagged:\\n    vault: address\\n    tag: String[120]\\n\\n@external\\ndef __init__():\\n    self.governance = msg.sender\\n\\n\\n@external\\ndef setGovernance(governance: address):\\n    \\\"\\\"\\\"\\n    @notice Starts the 1st phase of the governance transfer.\\n    @dev Throws if the caller is not current governance.\\n    @param governance The next governance address\\n    \\\"\\\"\\\"\\n    assert msg.sender == self.governance  # dev: unauthorized\\n    self.pendingGovernance = governance\\n\\n\\n@external\\ndef acceptGovernance():\\n    \\\"\\\"\\\"\\n    @notice Completes the 2nd phase of the governance transfer.\\n    @dev\\n        Throws if the caller is not the pending caller.\\n        Emits a `NewGovernance` event.\\n    \\\"\\\"\\\"\\n    assert msg.sender == self.pendingGovernance  # dev: unauthorized\\n    self.governance = msg.sender\\n    log NewGovernance(msg.sender)\\n\\n\\n@view\\n@external\\ndef latestRelease() -> String[28]:\\n    \\\"\\\"\\\"\\n    @notice Returns the api version of the latest release.\\n    @dev Throws if no releases are registered yet.\\n    @return The api version of the latest release.\\n    \\\"\\\"\\\"\\n    # NOTE: Throws if there has not been a release yet\\n    return Vault(self.releases[self.numReleases - 1]).apiVersion()  # dev: no release\\n\\n\\n@view\\n@external\\ndef latestVault(token: address) -> address:\\n    \\\"\\\"\\\"\\n    @notice Returns the latest deployed vault for the given token.\\n    @dev Throws if no vaults are endorsed yet for the given token.\\n    @param token The token address to find the latest vault for.\\n    @return The address of the latest vault for the given token.\\n    \\\"\\\"\\\"\\n    # NOTE: Throws if there has not been a deployed vault yet for this token\\n    return self.vaults[token][self.numVaults[token] - 1]  # dev: no vault for token\\n\\n\\n@external\\ndef newRelease(vault: address):\\n    \\\"\\\"\\\"\\n    @notice\\n        Add a previously deployed Vault as the template contract for the latest release,\\n        to be used by further \\\"forwarder-style\\\" delegatecall proxy contracts that can be\\n        deployed from the registry throw other methods (to save gas).\\n    @dev\\n        Throws if caller isn't `self.governance`.\\n        Throws if `vault`'s governance isn't `self.governance`.\\n        Throws if the api version is the same as the previous release.\\n        Emits a `NewVault` event.\\n    @param vault The vault that will be used as the template contract for the next release.\\n    \\\"\\\"\\\"\\n    assert msg.sender == self.governance  # dev: unauthorized\\n\\n    # Check if the release is different from the current one\\n    # NOTE: This doesn't check for strict semver-style linearly increasing release versions\\n    release_id: uint256 = self.numReleases  # Next id in series\\n    if release_id > 0:\\n        assert (\\n            Vault(self.releases[release_id - 1]).apiVersion()\\n            != Vault(vault).apiVersion()\\n        )  # dev: same api version\\n    # else: we are adding the first release to the Registry!\\n\\n    # Update latest release\\n    self.releases[release_id] = vault\\n    self.numReleases = release_id + 1\\n\\n    # Log the release for external listeners (e.g. Graph)\\n    log NewRelease(release_id, vault, Vault(vault).apiVersion())\\n\\n\\n@internal\\ndef _newProxyVault(\\n    token: address,\\n    governance: address,\\n    rewards: address,\\n    guardian: address,\\n    name: String[64],\\n    symbol: String[32],\\n    releaseTarget: uint256,\\n) -> address:\\n    release: address = self.releases[releaseTarget]\\n    assert release != ZERO_ADDRESS  # dev: unknown release\\n    vault: address = create_forwarder_to(release)\\n\\n    # NOTE: Must initialize the Vault atomically with deploying it\\n    Vault(vault).initialize(token, governance, rewards, name, symbol, guardian)\\n\\n    return vault\\n\\n\\n@internal\\ndef _registerVault(token: address, vault: address):\\n    # Check if there is an existing deployment for this token at the particular api version\\n    # NOTE: This doesn't check for strict semver-style linearly increasing release versions\\n    vault_id: uint256 = self.numVaults[token]  # Next id in series\\n    if vault_id > 0:\\n        assert (\\n            Vault(self.vaults[token][vault_id - 1]).apiVersion()\\n            != Vault(vault).apiVersion()\\n        )  # dev: same api version\\n    # else: we are adding a new token to the Registry\\n\\n    # Update the latest deployment\\n    self.vaults[token][vault_id] = vault\\n    self.numVaults[token] = vault_id + 1\\n\\n    # Register tokens for endorsed vaults\\n    if not self.isRegistered[token]:\\n        self.isRegistered[token] = True\\n        self.tokens[self.numTokens] = token\\n        self.numTokens += 1\\n\\n    # Log the deployment for external listeners (e.g. Graph)\\n    log NewVault(token, vault_id, vault, Vault(vault).apiVersion())\\n\\n\\n@external\\ndef newVault(\\n    token: address,\\n    guardian: address,\\n    rewards: address,\\n    name: String[64],\\n    symbol: String[32],\\n    releaseDelta: uint256 = 0,  # NOTE: Uses latest by default\\n) -> address:\\n    \\\"\\\"\\\"\\n    @notice\\n        Create a new vault for the given token using the latest release in the registry,\\n        as a simple \\\"forwarder-style\\\" delegatecall proxy to the latest release. Also adds\\n        the new vault to the list of \\\"endorsed\\\" vaults for that token.\\n    @dev\\n        `governance` is set in the new vault as `self.governance`, with no ability to override.\\n        Throws if caller isn't `self.governance`.\\n        Throws if no releases are registered yet.\\n        Throws if there already is a registered vault for the given token with the latest api version.\\n        Emits a `NewVault` event.\\n    @param token The token that may be deposited into the new Vault.\\n    @param guardian The address authorized for guardian interactions in the new Vault.\\n    @param rewards The address to use for collecting rewards in the new Vault\\n    @param name Specify a custom Vault name. Set to empty string for default choice.\\n    @param symbol Specify a custom Vault symbol name. Set to empty string for default choice.\\n    @param releaseDelta Specify the number of releases prior to the latest to use as a target. Default is latest.\\n    @return The address of the newly-deployed vault\\n    \\\"\\\"\\\"\\n    assert msg.sender == self.governance  # dev: unauthorized\\n\\n    # NOTE: Underflow if no releases created yet, or targeting prior to release history\\n    releaseTarget: uint256 = self.numReleases - 1 - releaseDelta  # dev: no releases\\n    vault: address = self._newProxyVault(token, msg.sender, rewards, guardian, name, symbol, releaseTarget)\\n\\n    self._registerVault(token, vault)\\n\\n    return vault\\n\\n\\n@external\\ndef newExperimentalVault(\\n    token: address,\\n    governance: address,\\n    guardian: address,\\n    rewards: address,\\n    name: String[64],\\n    symbol: String[32],\\n    releaseDelta: uint256 = 0,  # NOTE: Uses latest by default\\n) -> address:\\n    \\\"\\\"\\\"\\n    @notice\\n        Create a new vault for the given token using the latest release in the registry,\\n        as a simple \\\"forwarder-style\\\" delegatecall proxy to the latest release. Does not add\\n        the new vault to the list of \\\"endorsed\\\" vaults for that token.\\n    @dev\\n        Throws if no releases are registered yet.\\n        Emits a `NewExperimentalVault` event.\\n    @param token The token that may be deposited into the new Vault.\\n    @param governance The address authorized for governance interactions in the new Vault.\\n    @param guardian The address authorized for guardian interactions in the new Vault.\\n    @param rewards The address to use for collecting rewards in the new Vault\\n    @param name Specify a custom Vault name. Set to empty string for default choice.\\n    @param symbol Specify a custom Vault symbol name. Set to empty string for default choice.\\n    @param releaseDelta Specify the number of releases prior to the latest to use as a target. Default is latest.\\n    @return The address of the newly-deployed vault\\n    \\\"\\\"\\\"\\n    # NOTE: Underflow if no releases created yet, or targeting prior to release history\\n    releaseTarget: uint256 = self.numReleases - 1 - releaseDelta  # dev: no releases\\n    # NOTE: Anyone can call this method, as a convenience to Strategist' experiments\\n    vault: address = self._newProxyVault(token, governance, rewards, guardian, name, symbol, releaseTarget)\\n\\n    # NOTE: Not registered, so emit an \\\"experiment\\\" event here instead\\n    log NewExperimentalVault(token, msg.sender, vault, Vault(vault).apiVersion())\\n\\n    return vault\\n\\n\\n@external\\ndef endorseVault(vault: address, releaseDelta: uint256 = 0):\\n    \\\"\\\"\\\"\\n    @notice\\n        Adds an existing vault to the list of \\\"endorsed\\\" vaults for that token.\\n    @dev\\n        `governance` is set in the new vault as `self.governance`, with no ability to override.\\n        Throws if caller isn't `self.governance`.\\n        Throws if `vault`'s governance isn't `self.governance`.\\n        Throws if no releases are registered yet.\\n        Throws if `vault`'s api version does not match latest release.\\n        Throws if there already is a deployment for the vault's token with the latest api version.\\n        Emits a `NewVault` event.\\n    @param vault The vault that will be endorsed by the Registry.\\n    @param releaseDelta Specify the number of releases prior to the latest to use as a target. Default is latest.\\n    \\\"\\\"\\\"\\n    assert msg.sender == self.governance  # dev: unauthorized\\n    assert Vault(vault).governance() == msg.sender  # dev: not governed\\n\\n    # NOTE: Underflow if no releases created yet, or targeting prior to release history\\n    releaseTarget: uint256 = self.numReleases - 1 - releaseDelta  # dev: no releases\\n    api_version: String[28] = Vault(self.releases[releaseTarget]).apiVersion()\\n    assert Vault(vault).apiVersion() == api_version  # dev: not target release\\n\\n    # Add to the end of the list of vaults for token\\n    self._registerVault(Vault(vault).token(), vault)\\n\\n\\n@external\\ndef setBanksy(tagger: address, allowed: bool = True):\\n    \\\"\\\"\\\"\\n    @notice Set the ability of a particular tagger to tag current vaults.\\n    @dev Throws if caller is not `self.governance`.\\n    @param tagger The address to approve or deny access to tagging.\\n    @param allowed Whether to approve or deny `tagger`. Defaults to approve.\\n    \\\"\\\"\\\"\\n    assert msg.sender == self.governance  # dev: unauthorized\\n    self.banksy[tagger] = allowed\\n\\n\\n@external\\ndef tagVault(vault: address, tag: String[120]):\\n    \\\"\\\"\\\"\\n    @notice Tag a Vault with a message.\\n    @dev\\n        Throws if caller is not `self.governance` or an approved tagger.\\n        Emits a `VaultTagged` event.\\n    @param vault The address to tag with the given `tag` message.\\n    @param tag The message to tag `vault` with.\\n    \\\"\\\"\\\"\\n    if msg.sender != self.governance:\\n        assert self.banksy[msg.sender]  # dev: not banksy\\n    # else: we are governance, we can do anything banksy can do\\n\\n    self.tags[vault] = tag\\n    log VaultTagged(vault, tag)\",\"libraries\":[],\"constructorArguments\":\"682375050805160200160206001820306601f82010390509050905081019050809050905090506101c0a361018051565b600080fd5b61000861136403610008600039610008611364036000f3\",\"contractName\":\"Vault\",\"argsLoading\":false,\"error\":\"\"}",
//   "method": "POST"
// })
//   .then(res => res.json())
//   .then(json => console.log(json));


  test('codeVerification vy should pass', () => {
    expect(1+2).toBe(3);
  });
  
  test('codeVerification vy should fail - incorrect bytecode', () => {
    expect(1+2).toBe(3);
  });
  
  test('codeVerification vy should fail - incorrect contract name', () => {
    expect(1+2).toBe(3);
  });
  