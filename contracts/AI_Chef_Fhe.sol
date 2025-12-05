pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract AIChefFhe is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    bool public batchOpen;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    // Encrypted user data storage
    mapping(uint256 => mapping(address => euint32)) public userPreferences; // batchId => user => encryptedPreference
    mapping(uint256 => mapping(address => euint32)) public userAllergies;   // batchId => user => encryptedAllergy
    mapping(uint256 => mapping(address => euint32)) public userIngredients; // batchId => user => encryptedIngredient

    // Encrypted recipe output storage
    mapping(uint256 => mapping(address => euint32)) public recipeScores; // batchId => user => encryptedRecipeScore

    // Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PauseToggled(bool indexed paused);
    event CooldownSecondsSet(uint256 indexed oldCooldown, uint256 indexed newCooldown);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event UserDataSubmitted(address indexed user, uint256 indexed batchId);
    event RecipeGenerationRequested(uint256 indexed requestId, address indexed user, uint256 indexed batchId);
    event RecipeGenerationCompleted(uint256 indexed requestId, address indexed user, uint256 indexed batchId, uint32 recipeScore);

    // Custom Errors
    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchClosed();
    error InvalidBatch();
    error ReplayDetected();
    error StateMismatch();
    error InvalidProof();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier checkSubmissionCooldown() {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier checkDecryptionCooldown() {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true;
        cooldownSeconds = 60; // Default cooldown
        currentBatchId = 1; // Start with batch 1
        batchOpen = false;
        emit ProviderAdded(owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        if (!isProvider[provider]) {
            isProvider[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    function removeProvider(address provider) external onlyOwner {
        if (isProvider[provider]) {
            isProvider[provider] = false;
            emit ProviderRemoved(provider);
        }
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseToggled(_paused);
    }

    function setCooldownSeconds(uint256 newCooldown) external onlyOwner {
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = newCooldown;
        emit CooldownSecondsSet(oldCooldown, newCooldown);
    }

    function openBatch() external onlyOwner whenNotPaused {
        if (batchOpen) {
            currentBatchId++;
        }
        batchOpen = true;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() external onlyOwner whenNotPaused {
        if (batchOpen) {
            batchOpen = false;
            emit BatchClosed(currentBatchId);
        }
    }

    function submitUserData(
        euint32 _encryptedPreference,
        euint32 _encryptedAllergy,
        euint32 _encryptedIngredient
    ) external onlyProvider whenNotPaused checkSubmissionCooldown {
        if (!batchOpen) revert BatchClosed();
        if (!_encryptedPreference.isInitialized() || !_encryptedAllergy.isInitialized() || !_encryptedIngredient.isInitialized()) {
            _initIfNeeded(_encryptedPreference);
            _initIfNeeded(_encryptedAllergy);
            _initIfNeeded(_encryptedIngredient);
        }

        userPreferences[currentBatchId][msg.sender] = _encryptedPreference;
        userAllergies[currentBatchId][msg.sender] = _encryptedAllergy;
        userIngredients[currentBatchId][msg.sender] = _encryptedIngredient;

        lastSubmissionTime[msg.sender] = block.timestamp;
        emit UserDataSubmitted(msg.sender, currentBatchId);
    }

    function generateRecipe() external onlyProvider whenNotPaused checkDecryptionCooldown {
        if (!batchOpen) revert BatchClosed();
        if (!userPreferences[currentBatchId][msg.sender].isInitialized() ||
            !userAllergies[currentBatchId][msg.sender].isInitialized() ||
            !userIngredients[currentBatchId][msg.sender].isInitialized()) {
            revert InvalidBatch(); // User hasn't submitted data for this batch
        }

        // Placeholder for complex FHE logic:
        // euint32 memory score = FHE.add(userPreferences[currentBatchId][msg.sender], userIngredients[currentBatchId][msg.sender]);
        // score = FHE.sub(score, userAllergies[currentBatchId][msg.sender]);
        euint32 memory score = userPreferences[currentBatchId][msg.sender]; // Simplified for example

        recipeScores[currentBatchId][msg.sender] = score;
        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = score.toBytes32();

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({
            batchId: currentBatchId,
            stateHash: stateHash,
            processed: false
        });

        emit RecipeGenerationRequested(requestId, msg.sender, currentBatchId);
    }

    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        if (decryptionContexts[requestId].processed) revert ReplayDetected();
        // Security: Replay protection prevents processing the same decryption request multiple times.

        bytes32[] memory currentCts = new bytes32[](1);
        // Rebuild ciphertexts in the exact same order as during requestDecryption
        currentCts[0] = recipeScores[decryptionContexts[requestId].batchId][tx.origin].toBytes32(); // tx.origin is the user who initiated generateRecipe

        bytes32 currentHash = _hashCiphertexts(currentCts);
        // Security: State hash verification ensures that the contract state (specifically, the ciphertexts)
        // has not changed since the decryption was requested. This prevents scenarios where an attacker
        // might alter the state after a request but before decryption, leading to inconsistent results.
        if (currentHash != decryptionContexts[requestId].stateHash) revert StateMismatch();

        // Security: Proof verification ensures that the cleartexts were indeed decrypted by a valid FHE key holder
        // and that the decryption is correct and authorized.
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) revert InvalidProof();

        uint32 recipeScore = abi.decode(cleartexts, (uint32));
        decryptionContexts[requestId].processed = true;

        emit RecipeGenerationCompleted(requestId, tx.origin, decryptionContexts[requestId].batchId, recipeScore);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded(euint32 cipher) internal {
        if (!cipher.isInitialized()) cipher = FHE.asEuint32(0);
    }

    function _requireInitialized(euint32 cipher) internal pure {
        if (!cipher.isInitialized()) revert("Ciphertext not initialized");
    }
}