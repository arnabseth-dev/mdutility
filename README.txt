
mdutility – Application Setup & Usage Guide
-----------------------------------------------

1. Copy the folder named "mdutility" to your local machine.
   - Do NOT keep it inside any cloud sync folder (Example: avoid OneDrive/Google Drive/iCloud).
   - Store it in a normal local directory like:
     C:\Projects\mdutility\
     or
     /home/user/mdutility/

-----------------------------------------------

Prerequisites:

Node.js version required: 20.0.9
Python version required: 3.14.1

-----------------------------------------------

Install Node.js & Python through CLI if not already installed:

Windows (PowerShell):
winget install OpenJS.NodeJS --version 20.0.9
winget install Python.Python.3.14

macOS (Terminal):
brew install node@20
brew install python@3.14

Linux (Debian/Ubuntu):
sudo apt update
sudo apt install nodejs python3

-----------------------------------------------

Running the Application:

Windows:
Double click or run:
runapp.bat

macOS / Linux:
First time only:
chmod +x runapp.sh
Then run:
./runapp.sh

-----------------------------------------------

First Run Notes:

- First time setup may take 1–2 minutes because dependencies will be downloaded.
- Next runs will start much faster.

-----------------------------------------------

What the Startup Scripts Do:

- Automatically install required Node and Python dependencies.
- Prepare the environment.
- Launch the application.

-----------------------------------------------

End of Document
