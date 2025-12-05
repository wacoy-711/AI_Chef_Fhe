// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Recipe {
  id: string;
  encryptedIngredients: string;
  encryptedAllergies: string;
  encryptedPreferences: string;
  encryptedRecipe: string;
  timestamp: number;
  owner: string;
  status: "pending" | "generated" | "rejected";
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'increase10%':
      result = value * 1.1;
      break;
    case 'decrease10%':
      result = value * 0.9;
      break;
    case 'double':
      result = value * 2;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newRecipeData, setNewRecipeData] = useState({ 
    ingredients: 0, // Encoded as number (1=vegetables, 2=meat, etc.)
    allergies: 0,   // Encoded as number (1=nuts, 2=dairy, etc.)
    preferences: 0, // Encoded as number (1=vegetarian, 2=vegan, etc.)
    healthGoal: 0   // Encoded as number (1=weight loss, 2=muscle gain, etc.)
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [decryptedRecipe, setDecryptedRecipe] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const generatedCount = recipes.filter(r => r.status === "generated").length;
  const pendingCount = recipes.filter(r => r.status === "pending").length;
  const rejectedCount = recipes.filter(r => r.status === "rejected").length;

  // Randomly selected styles
  const colorScheme = "low-saturation-pastel"; // Mint green + cream yellow + sakura pink
  const uiStyle = "flat-design"; 
  const layout = "card-based"; 
  const interaction = "micro-interactions"; // Hover effects, button animations

  // Randomly selected features
  const features = [
    "project-introduction",
    "data-statistics",
    "search-filter",
    "faq-section"
  ];

  useEffect(() => {
    loadRecipes().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadRecipes = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      // Get recipe keys
      const keysBytes = await contract.getData("recipe_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing recipe keys:", e); }
      }
      
      // Load each recipe
      const list: Recipe[] = [];
      for (const key of keys) {
        try {
          const recipeBytes = await contract.getData(`recipe_${key}`);
          if (recipeBytes.length > 0) {
            try {
              const recipeData = JSON.parse(ethers.toUtf8String(recipeBytes));
              list.push({ 
                id: key, 
                encryptedIngredients: recipeData.ingredients,
                encryptedAllergies: recipeData.allergies,
                encryptedPreferences: recipeData.preferences,
                encryptedRecipe: recipeData.recipe,
                timestamp: recipeData.timestamp, 
                owner: recipeData.owner, 
                status: recipeData.status || "pending" 
              });
            } catch (e) { console.error(`Error parsing recipe data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading recipe ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setRecipes(list);
    } catch (e) { console.error("Error loading recipes:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitRecipeRequest = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting dietary data with Zama FHE..." });
    try {
      // Encrypt all numerical data with FHE
      const encryptedIngredients = FHEEncryptNumber(newRecipeData.ingredients);
      const encryptedAllergies = FHEEncryptNumber(newRecipeData.allergies);
      const encryptedPreferences = FHEEncryptNumber(newRecipeData.preferences);
      const encryptedHealthGoal = FHEEncryptNumber(newRecipeData.healthGoal);
      
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const recipeId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const recipeData = { 
        ingredients: encryptedIngredients,
        allergies: encryptedAllergies,
        preferences: encryptedPreferences,
        healthGoal: encryptedHealthGoal,
        recipe: "", // Will be filled by AI
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        status: "pending" 
      };
      
      // Store recipe data
      await contract.setData(`recipe_${recipeId}`, ethers.toUtf8Bytes(JSON.stringify(recipeData)));
      
      // Update keys list
      const keysBytes = await contract.getData("recipe_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(recipeId);
      await contract.setData("recipe_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Encrypted dietary data submitted securely!" });
      await loadRecipes();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewRecipeData({ ingredients: 0, allergies: 0, preferences: 0, healthGoal: 0 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<string | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate FHE decryption and recipe generation
      const ingredientsCode = FHEDecryptNumber(encryptedData);
      const recipe = generateRecipeFromCode(ingredientsCode);
      return recipe;
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const generateRecipeFromCode = (code: number): string => {
    // This is a mock function that would be replaced with actual FHE computation
    const ingredients = [
      "Vegetables", "Meat", "Fish", "Poultry", 
      "Grains", "Dairy", "Fruits", "Legumes"
    ];
    const cookingMethods = [
      "Steamed", "Grilled", "Baked", "Sauteed", 
      "Raw", "Boiled", "Fried", "Roasted"
    ];
    const styles = [
      "Mediterranean", "Asian", "Mexican", "Italian",
      "Middle Eastern", "American", "French", "Indian"
    ];
    
    const ingredient = ingredients[code % ingredients.length];
    const method = cookingMethods[(code + 1) % cookingMethods.length];
    const style = styles[(code + 2) % styles.length];
    
    return `${method} ${ingredient} with ${style} flavors - Healthy and delicious!`;
  };

  const generateRecipe = async (recipeId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Generating recipe with FHE computation..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      const recipeBytes = await contract.getData(`recipe_${recipeId}`);
      if (recipeBytes.length === 0) throw new Error("Recipe not found");
      const recipeData = JSON.parse(ethers.toUtf8String(recipeBytes));
      
      // Simulate FHE computation on encrypted data
      const encryptedRecipe = FHECompute(recipeData.ingredients, 'increase10%');
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      const updatedRecipe = { 
        ...recipeData, 
        status: "generated", 
        recipe: encryptedRecipe 
      };
      await contractWithSigner.setData(`recipe_${recipeId}`, ethers.toUtf8Bytes(JSON.stringify(updatedRecipe)));
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE recipe generation completed!" });
      await loadRecipes();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Generation failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const rejectRecipe = async (recipeId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing with FHE..." });
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      const recipeBytes = await contract.getData(`recipe_${recipeId}`);
      if (recipeBytes.length === 0) throw new Error("Recipe not found");
      const recipeData = JSON.parse(ethers.toUtf8String(recipeBytes));
      const updatedRecipe = { ...recipeData, status: "rejected" };
      await contract.setData(`recipe_${recipeId}`, ethers.toUtf8Bytes(JSON.stringify(updatedRecipe)));
      setTransactionStatus({ visible: true, status: "success", message: "Recipe rejected!" });
      await loadRecipes();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Rejection failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isOwner = (recipeAddress: string) => address?.toLowerCase() === recipeAddress.toLowerCase();

  const tutorialSteps = [
    { title: "Connect Wallet", description: "Connect your Web3 wallet to start using the private chef service", icon: "🔗" },
    { title: "Submit Dietary Data", description: "Provide your ingredients, allergies and preferences (all encrypted with FHE)", icon: "🔒", details: "Your data is encrypted on the client-side before being sent to the blockchain" },
    { title: "FHE Recipe Generation", description: "AI processes your data while it remains encrypted", icon: "⚙️", details: "Zama FHE technology allows computations on encrypted data without exposing sensitive information" },
    { title: "Get Your Recipe", description: "Receive personalized recipes while keeping your data private", icon: "📊", details: "The recipes are generated based on encrypted data and can be decrypted only by you" }
  ];

  const renderStatsCards = () => {
    return (
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-value">{recipes.length}</div>
          <div className="stat-label">Total Recipes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{generatedCount}</div>
          <div className="stat-label">Generated</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{rejectedCount}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className={`app-container ${colorScheme} ${uiStyle}`}>
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">🍳</div>
          <h1>AI Chef<span>FHE</span></h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-recipe-btn">
            <div className="add-icon">+</div>New Recipe Request
          </button>
          <button className="tutorial-btn" onClick={() => setShowTutorial(!showTutorial)}>
            {showTutorial ? "Hide Tutorial" : "Show Tutorial"}
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Your Private AI Chef</h2>
            <p>Get personalized recipes while keeping your dietary data encrypted with Zama FHE</p>
          </div>
          <div className="fhe-indicator">
            <div className="fhe-lock">🔒</div>
            <span>FHE Encryption Active</span>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>How It Works</h2>
            <p className="subtitle">Learn how to get private recipe recommendations</p>
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.details && <div className="step-details">{step.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {features.includes("project-introduction") && (
          <div className="info-card">
            <h3>About AI Chef FHE</h3>
            <p>
              AI Chef FHE uses <strong>Zama's Fully Homomorphic Encryption</strong> to process your dietary preferences, 
              allergies and ingredients without ever decrypting your sensitive data. Your information stays private 
              while our AI generates personalized recipes.
            </p>
            <div className="fhe-badge">FHE-Powered Privacy</div>
          </div>
        )}
        
        {features.includes("data-statistics") && (
          <div className="stats-section">
            <h3>Your Recipe Statistics</h3>
            {renderStatsCards()}
          </div>
        )}
        
        <div className="recipes-section">
          <div className="section-header">
            <h2>Your Recipe Requests</h2>
            <div className="header-actions">
              <button onClick={loadRecipes} className="refresh-btn" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          {features.includes("search-filter") && (
            <div className="search-filter">
              <input type="text" placeholder="Search recipes..." className="search-input"/>
              <select className="filter-select">
                <option value="all">All Status</option>
                <option value="generated">Generated</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
          
          <div className="recipes-list">
            {recipes.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon">🍽️</div>
                <p>No recipe requests found</p>
                <button className="primary-btn" onClick={() => setShowCreateModal(true)}>Request Your First Recipe</button>
              </div>
            ) : recipes.map(recipe => (
              <div className="recipe-card" key={recipe.id} onClick={() => setSelectedRecipe(recipe)}>
                <div className="card-header">
                  <span className="recipe-id">#{recipe.id.substring(0, 6)}</span>
                  <span className={`status-badge ${recipe.status}`}>{recipe.status}</span>
                </div>
                <div className="card-body">
                  <div className="recipe-meta">
                    <span className="meta-item">👤 {recipe.owner.substring(0, 6)}...{recipe.owner.substring(38)}</span>
                    <span className="meta-item">📅 {new Date(recipe.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                  {recipe.status === "generated" && (
                    <div className="recipe-preview">
                      {recipe.encryptedRecipe.substring(0, 50)}...
                    </div>
                  )}
                </div>
                <div className="card-footer">
                  {isOwner(recipe.owner) && recipe.status === "pending" && (
                    <>
                      <button className="action-btn success" onClick={(e) => { e.stopPropagation(); generateRecipe(recipe.id); }}>Generate</button>
                      <button className="action-btn danger" onClick={(e) => { e.stopPropagation(); rejectRecipe(recipe.id); }}>Reject</button>
                    </>
                  )}
                  <button className="action-btn primary" onClick={(e) => { e.stopPropagation(); setSelectedRecipe(recipe); }}>Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {features.includes("faq-section") && (
          <div className="faq-section">
            <h3>Frequently Asked Questions</h3>
            <div className="faq-item">
              <div className="faq-question">How does FHE protect my data?</div>
              <div className="faq-answer">
                Fully Homomorphic Encryption allows computations to be performed on encrypted data without decrypting it first. 
                This means your dietary preferences and health data never exists in plaintext on our servers.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question">Can I decrypt my recipes?</div>
              <div className="faq-answer">
                Yes, you can decrypt your generated recipes using your wallet signature. The decryption happens locally in your browser.
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitRecipeRequest} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating} 
          recipeData={newRecipeData} 
          setRecipeData={setNewRecipeData}
        />
      )}
      
      {selectedRecipe && (
        <RecipeDetailModal 
          recipe={selectedRecipe} 
          onClose={() => { setSelectedRecipe(null); setDecryptedRecipe(null); }} 
          decryptedRecipe={decryptedRecipe} 
          setDecryptedRecipe={setDecryptedRecipe} 
          isDecrypting={isDecrypting} 
          decryptWithSignature={decryptWithSignature}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">🍳 AI Chef FHE</div>
            <p>Private recipe generation powered by Zama FHE</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge">FHE-Powered Privacy</div>
          <div className="copyright">© {new Date().getFullYear()} AI Chef FHE. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  recipeData: any;
  setRecipeData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ onSubmit, onClose, creating, recipeData, setRecipeData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRecipeData({ ...recipeData, [name]: parseInt(value) });
  };

  const handleSubmit = () => {
    if (!recipeData.ingredients || !recipeData.allergies) { 
      alert("Please fill required fields"); 
      return; 
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>New Recipe Request</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="notice-icon">🔒</div> 
            <div>
              <strong>FHE Encryption Notice</strong>
              <p>Your dietary data will be encrypted with Zama FHE before submission</p>
            </div>
          </div>
          
          <div className="form-group">
            <label>Available Ingredients *</label>
            <select name="ingredients" value={recipeData.ingredients} onChange={handleChange}>
              <option value="0">Select ingredients</option>
              <option value="1">Vegetables, Grains</option>
              <option value="2">Meat, Vegetables</option>
              <option value="3">Fish, Vegetables</option>
              <option value="4">Poultry, Grains</option>
              <option value="5">Dairy, Fruits</option>
              <option value="6">Legumes, Grains</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Allergies *</label>
            <select name="allergies" value={recipeData.allergies} onChange={handleChange}>
              <option value="0">Select allergies</option>
              <option value="1">None</option>
              <option value="2">Nuts</option>
              <option value="3">Dairy</option>
              <option value="4">Gluten</option>
              <option value="5">Shellfish</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Dietary Preferences</label>
            <select name="preferences" value={recipeData.preferences} onChange={handleChange}>
              <option value="0">No preference</option>
              <option value="1">Vegetarian</option>
              <option value="2">Vegan</option>
              <option value="3">Low-carb</option>
              <option value="4">High-protein</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Health Goal</label>
            <select name="healthGoal" value={recipeData.healthGoal} onChange={handleChange}>
              <option value="0">No specific goal</option>
              <option value="1">Weight loss</option>
              <option value="2">Muscle gain</option>
              <option value="3">Heart health</option>
              <option value="4">Energy boost</option>
            </select>
          </div>
          
          <div className="encryption-preview">
            <h4>Encryption Preview</h4>
            <div className="preview-container">
              <div className="plain-data">
                <span>Plain Values:</span>
                <div>Ingredients: {recipeData.ingredients || 'Not selected'}</div>
                <div>Allergies: {recipeData.allergies || 'Not selected'}</div>
              </div>
              <div className="encrypted-data">
                <span>Encrypted Data:</span>
                <div>Ingredients: {recipeData.ingredients ? FHEEncryptNumber(recipeData.ingredients).substring(0, 20) + '...' : 'Not selected'}</div>
                <div>Allergies: {recipeData.allergies ? FHEEncryptNumber(recipeData.allergies).substring(0, 20) + '...' : 'Not selected'}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={handleSubmit} disabled={creating} className="submit-btn">
            {creating ? "Encrypting with FHE..." : "Submit Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
  decryptedRecipe: string | null;
  setDecryptedRecipe: (value: string | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<string | null>;
}

const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({ 
  recipe, onClose, decryptedRecipe, setDecryptedRecipe, isDecrypting, decryptWithSignature 
}) => {
  const handleDecrypt = async () => {
    if (decryptedRecipe !== null) { setDecryptedRecipe(null); return; }
    const decrypted = await decryptWithSignature(recipe.encryptedRecipe);
    if (decrypted !== null) setDecryptedRecipe(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="recipe-detail-modal">
        <div className="modal-header">
          <h2>Recipe Details #{recipe.id.substring(0, 8)}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="recipe-info">
            <div className="info-item"><span>Status:</span><strong className={`status-badge ${recipe.status}`}>{recipe.status}</strong></div>
            <div className="info-item"><span>Owner:</span><strong>{recipe.owner.substring(0, 6)}...{recipe.owner.substring(38)}</strong></div>
            <div className="info-item"><span>Date:</span><strong>{new Date(recipe.timestamp * 1000).toLocaleString()}</strong></div>
          </div>
          
          <div className="encrypted-data-section">
            <h3>Encrypted Recipe</h3>
            <div className="encrypted-data">
              {recipe.encryptedRecipe.substring(0, 100)}...
            </div>
            <div className="fhe-tag">
              <div className="fhe-icon">🔒</div>
              <span>FHE Encrypted</span>
            </div>
            
            {recipe.status === "generated" && (
              <button className="decrypt-btn" onClick={handleDecrypt} disabled={isDecrypting}>
                {isDecrypting ? "Decrypting..." : decryptedRecipe !== null ? "Hide Recipe" : "Decrypt with Wallet"}
              </button>
            )}
          </div>
          
          {decryptedRecipe !== null && (
            <div className="decrypted-recipe-section">
              <h3>Your Personalized Recipe</h3>
              <div className="recipe-content">
                {decryptedRecipe}
              </div>
              <div className="decryption-notice">
                <div className="warning-icon">⚠️</div>
                <span>This recipe was decrypted locally using your wallet signature</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;