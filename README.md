# Monet: Video Mask Annotation Made Easy

Monet is a personal project designed to simplify mask annotation on videos. It is a web application that combines a React-based frontend with a FastAPI backend, leveraging the SAM2 model to provide efficient and user-friendly annotation tools.

## Installation

Follow these steps to install and set up Monet:

1. Clone the repository:
   ```bash
   git clone <repository_url>
   cd Monet
   ``` 
2. Choose your package manager (npm, bun, or pnpm) and install dependencies:
   ```bash
    npm install
   ``` 

3. Set up the API:
   ```bash
    cd api/
    uv sync
    cd ..
   ``` 

## Running in Development Mode

1. Start the API
Navigate to the api directory and run the FastAPI development server:
   ```bash
    cd api/
    uv run fastapi dev
   ``` 

2. Start the Frontend
In the root directory, run the React development server:
   ```bash
    npm run
   ``` 

Once both servers are running, the application will be accessible in your web browser.

## License

This project is licensed under the MIT License.

Feel free to use, modify, and distribute it as per the license terms.