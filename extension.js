const vscode = require("vscode");
const axios = require("axios");

async function loadOctokit() {
    const { Octokit } = await import('@octokit/rest');
    return Octokit;
}
let Octokit1;
(async () => {
    Octokit1 = await loadOctokit();
})();

let outputChannel;

// GitHub OAuth App credentials
const CLIENT_ID = "Ov23liGkKJGdjqJ1tmc6";
const CLIENT_SECRET = "820b46d46ef1b3f480b091d5f30d76bdcb12a4db";

let octokit;

async function authenticate() {
    if (CLIENT_ID != 'Ov23liGkKJGdjqJ1tmc6' || CLIENT_SECRET != '820b46d46ef1b3f480b091d5f30d76bdcb12a4db') {
        vscode.window.showErrorMessage('Please configure your GitHub OAuth credentials first!');
        return;
    }

    // Create a GitHub OAuth URL
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo user`;
    
    // Start local server to handle OAuth callback
    const server = require('http').createServer();
    const port = 3000;
    
    // Promise to handle the OAuth callback
    const handleCallback = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            server.close();
            reject(new Error('Authentication timed out after 2 minutes'));
        }, 120000); // 2 minute timeout

        server.on('request', async (req, res) => {
            // console.log('Received callback request:', req.url);
            outputChannel.appendLine('Received callback request: ' + req.url);
            const url = new URL(req.url, `http://localhost:${port}`);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            
            if (error) {
                clearTimeout(timeout);
                reject(new Error(`GitHub OAuth error: ${error}`));
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('Authentication failed: ' + error);
                return;
            }

            if (code) {
                try {
                    // console.log('Exchanging code for access token...');
                    outputChannel.appendLine('Exchanging code for access token...');
                    // Exchange code for access token
                    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
                        client_id: CLIENT_ID,
                        client_secret: CLIENT_SECRET,
                        code: code
                    }, {
                        headers: {
                            Accept: 'application/json'
                        }
                    });

                    if (!tokenResponse.data.access_token) {
                        throw new Error('No access token received');
                    }

                    const accessToken = tokenResponse.data.access_token;
                    // console.log('Access token received successfully');
                    outputChannel.appendLine('Access token received successfully');
                    
                    // Send success response to browser
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h1>Authentication successful!</h1><p>You can close this window and return to VS Code.</p>');
                    
                    // Clear timeout and resolve promise
                    clearTimeout(timeout);
                    server.close();
                    resolve(accessToken);
                } catch (error) {
                    console.error('Token exchange error:', error.message);
                    clearTimeout(timeout);
                    reject(error);
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('Authentication failed! Please try again.');
                }
            }
        });

        server.on('error', (err) => {
            console.error('Server error:', err);
            clearTimeout(timeout);
            reject(err);
        });
    });

    try {
        console.log('Starting local server...');
        // Start server
        server.listen(port, async () => {
            // console.log('Local server listening on port 3000');
            outputChannel.appendLine('Local server listening on port 3000');
            // Open GitHub login in browser
            const uri = vscode.Uri.parse(githubUrl);
            await vscode.env.openExternal(uri);
            vscode.window.showInformationMessage('GitHub authentication page opened in browser. Please complete the login process.');
        });

        // Wait for the callback
        // console.log('Waiting for GitHub callback...');
        outputChannel.appendLine('Waiting for GitHub callback...');
        const accessToken = await handleCallback;
        
        // Initialize Octokit with the access token
        // console.log('Initializing Octokit...');
        outputChannel.appendLine('Initializing Octokit...');
        octokit = new Octokit1({
			auth: accessToken
		});

        vscode.window.showInformationMessage('Successfully authenticated with GitHub!');
        
        // Fetch and display repos
        await listRepositories();
    } catch (error) {
        console.error('Authentication error:', error.message);
        vscode.window.showErrorMessage(`Failed to authenticate with GitHub: ${error.message}`);
    }
}

async function listRepositories() {
    if (!octokit) {
        vscode.window.showErrorMessage('Not authenticated with GitHub. Please authenticate first.');
        return;
    }

    try {
        console.log('Fetching repositories...');
        const { data: repos } = await octokit.repos.listForAuthenticatedUser();
        
        console.log('Your GitHub Repositories:');
        outputChannel.appendLine('Your GitHub Repositories:');
        outputChannel.appendLine('-----------------------------------');
        repos.forEach(repo => {
            // console.log(`\nName: ${repo.name}`);
            outputChannel.appendLine(`Name: ${repo.name}`);
            // console.log(`Description: ${repo.description || 'No description'}`);
            outputChannel.appendLine(`Description: ${repo.description || 'No description'}`);
            // console.log(`URL: ${repo.html_url}`);
            outputChannel.appendLine(`URL: ${repo.html_url}`);
            // console.log(`Stars: ${repo.stargazers_count}`);
            outputChannel.appendLine(`Stars: ${repo.stargazers_count}`);
            // console.log(`Language: ${repo.language || 'Not specified'}`);
            outputChannel.appendLine(`Language: ${repo.language || 'Not specified'}`);
            console.log('-----------------------------------');
        });

        vscode.window.showInformationMessage(`Successfully fetched ${repos.length} repositories!`);
    } catch (error) {
        console.error('Repository fetch error:', error.message);
        vscode.window.showErrorMessage(`Failed to fetch repositories: ${error.message}`);
    }
}

function activate(context) {
    outputChannel = vscode.window.createOutputChannel('GitHub Authentication');
    outputChannel.show();
    console.log('Activating GitHub Repos extension...');
    let disposable = vscode.commands.registerCommand('gitbolt.login', authenticate);
    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}