# AI Chef: Your Personal FHE-Powered Culinary Assistant 👩‍🍳

AI Chef is an innovative application that utilizes **Zama's Fully Homomorphic Encryption (FHE) technology** to transform the way you approach meal preparation. By allowing users to input their dietary preferences, allergen history, and existing pantry ingredients, AI Chef generates personalized, healthy recipes—all while keeping your sensitive health information secure and private.

## The Challenge of Personalization in Diet

In today's fast-paced world, maintaining a healthy diet tailored to individual needs can be daunting. Many users face challenges such as:
- Fear of sharing personal health information with conventional apps.
- The struggle of finding recipes suited to specific dietary restrictions or preferences.
- Inadequate knowledge about utilizing existing ingredients effectively to minimize waste.

AI Chef resolves these issues by providing a solution that respects privacy while delivering customized culinary experiences.

## How FHE Enhances Your Culinary Experience

At the heart of AI Chef lies **Zama's Fully Homomorphic Encryption**, which enables the application to perform computations on encrypted data. This means that user inputs—like dietary restrictions and ingredient inventories—are processed securely without ever exposing sensitive information. By utilizing Zama's open-source libraries, such as **Concrete**, we ensure that your data remains confidential throughout the recipe generation process. This innovative approach not only protects users' privacy but also allows for highly personalized lifestyle services that cater to individual needs.

## Core Features of AI Chef 🍽️

- **Dietary Data Encryption:** User dietary preferences and allergen histories are encrypted using FHE to ensure privacy.
- **Dynamic Recipe Generation:** The AI algorithm executes computations homomorphically to create recipes tailored to user specifics.
- **Ingredient Management:** Users can input current pantry items, and AI Chef will generate recipes based on what is available, minimizing food waste.
- **Personalized Culinary Suggestions:** High levels of customization allow users to receive recommendations that align with their health goals and tastes.
- **Interactive AI Experience:** Users can engage with AI Chef for customized meal planning across various dietary profiles.

## Technology Stack 🛠️

- **Zama FHE SDK (Concrete, TFHE-rs)**: Core technology for secure computations
- **Node.js**: JavaScript runtime for developing scalable applications
- **Hardhat**: Ethereum development environment for compiling, deploying, and testing smart contracts
- **React**: Front-end framework for building user interfaces

## Directory Structure 📁

```
AI_Chef_Fhe/
│
├── contracts/
│   └── AI_Chef.sol
│
├── src/
│   ├── components/
│   ├── utils/
│   └── App.js
│
├── test/
│   └── AI_Chef.test.js
│
├── package.json
└── hardhat.config.js
```

## Installation Guide 🚀

To get started with AI Chef, follow these steps:

1. **Ensure you have the required tools installed:**
   - Node.js (version 14 or higher)
   - Hardhat

2. **Set up the project locally:**
   - Navigate to your project folder in the terminal.
   - Run `npm install` to fetch the required dependencies, including Zama FHE libraries.

**Installation Note:** Do not use `git clone` or any URLs. You should download the project files and follow the steps above.

## Build & Run Instructions 🏗️

Once the setup is complete, you can build and run the project using the following commands:

1. **Compile the smart contracts:**
   ```bash
   npx hardhat compile
   ```

2. **Test the smart contracts:**
   ```bash
   npx hardhat test
   ```

3. **Run the local development server:**
   ```bash
   npm start
   ```

### Example Usage

Here’s a quick example of how to leverage the AI Chef's main function for generating a recipe based on user input:

```javascript
import { generateRecipe } from './utils/recipeGenerator';

const userPreferences = {
    dietaryRestrictions: ['gluten-free', 'vegan'],
    allergens: ['nuts'],
    availableIngredients: ['broccoli', 'chickpeas', 'quinoa']
};

const recipe = generateRecipe(userPreferences);
console.log(recipe);
```

In this code snippet, the function `generateRecipe` processes the user's dietary information securely and provides a suitable recipe that aligns with their health goals.

## Acknowledgements 🙏

### Powered by Zama

A heartfelt thank you to the Zama team for their pioneering work in the field of Fully Homomorphic Encryption. Your open-source tools make it possible to create applications like AI Chef, which prioritize user privacy while providing valuable services. Together, we are redefining how technology and privacy can work hand in hand to enhance everyday life.
