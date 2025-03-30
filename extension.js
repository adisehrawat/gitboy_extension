const vscode = require("vscode");
const axios = require("axios");
const path = require("path");

async function loadSimpleGit() {
  const { default: simpleGit } = await import("simple-git");
  return simpleGit;
}

// Dynamically import Octokit to avoid issues with Webpack
async function loadOctokit() {
  const { Octokit } = await import("@octokit/rest");
  return Octokit;
}
let Octokit1;
(async () => {
  Octokit1 = await loadOctokit();
})();

const outputChannel = vscode.window.createOutputChannel("GitBolt");

// GitHub OAuth App credentials
const CLIENT_ID = "Ov23liGkKJGdjqJ1tmc6";
const CLIENT_SECRET = "820b46d46ef1b3f480b091d5f30d76bdcb12a4db";
const REDIRECT_URI = "vscode://aditya.gitbolt/auth-callback"; // Update with your extension ID

let octokit;

async function authenticate() {
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=repo`;

  // Open GitHub login in browser
  const uri = vscode.Uri.parse(githubUrl);
  await vscode.env.openExternal(uri);

  vscode.window.showInformationMessage(
    "GitHub login opened in your browser. Please complete the login process."
  );
}

// Handle the redirect callback and get the access token
/**
 * @param {{ query: string | import("url").URLSearchParams | Record<string, string | readonly string[]> | Iterable<[string, string]> | readonly [string, string][]; }} uri
 */
async function handleUri(uri) {
  const query = new URLSearchParams(uri.query);
  const code = query.get("code");

  if (!code) {
    vscode.window.showErrorMessage("Authentication failed. No code received.");
    return;
  }

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error("No access token received.");
    }

    // Initialize Octokit with access token
    octokit = new Octokit1({
      auth: accessToken,
    });

    vscode.window.showInformationMessage(
      "Successfully authenticated with GitHub!"
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Authentication error: ${error.message}`);
  }
}

// List repositories after authentication
async function listRepositories() {
  if (!octokit) {
    vscode.window.showErrorMessage(
      "Not authenticated with GitHub. Please authenticate first."
    );
    return;
  }

  try {
    const { data: repos } = await octokit.repos.listForAuthenticatedUser();

    // Clear previous output
    outputChannel.clear();

    if (repos.length === 0) {
      outputChannel.appendLine(
        "No repositories found for the authenticated user."
      );
      outputChannel.show(true);
      return;
    }

    // Display repository information in output channel
    outputChannel.appendLine(`Found ${repos.length} repositories:`);
    outputChannel.appendLine("----------------------------------------");

    repos.forEach((repo, index) => {
      outputChannel.appendLine(`${index + 1}. ${repo.full_name}`);
      outputChannel.appendLine(`   URL: ${repo.html_url}`);
      outputChannel.appendLine(
        `   Description: ${repo.description || "No description"}`
      );
      outputChannel.appendLine("----------------------------------------");
    });

    // Show the output channel
    outputChannel.show(true);

    vscode.window.showInformationMessage(
      `Successfully listed ${repos.length} repositories in Output window!`
    );
  } catch (error) {
    outputChannel.appendLine(`Failed to fetch repositories: ${error.message}`);
    outputChannel.show(true);
    vscode.window.showErrorMessage(
      "Failed to fetch repositories. Check Output window for details."
    );
  }
}

async function getDirectory() {
  const workspaceFolder = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : null;

  if (workspaceFolder) {
    const dirName = path.basename(workspaceFolder);
    vscode.window.showInformationMessage(`Current Directory: ${dirName}`);
    return dirName;
  } else {
    vscode.window.showErrorMessage("No folder is opened in the workspace.");
    return null;
  }
}
let gitHubUsername = "";

// Get GitHub username after successful authentication
async function getGitHubUsername() {
  try {
    const { data: user } = await octokit.users.getAuthenticated();
    gitHubUsername = user.login;

    vscode.window.showInformationMessage(`Authenticated as: ${gitHubUsername}`);
  } catch (error) {
    vscode.window.showErrorMessage(
      `❌ Error fetching GitHub username: ${error.message}`
    );
  }
}

async function initRepo() {
    const workspaceFolder = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : null;
  
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No folder is opened in the workspace.");
      return;
    }
  
    const simpleGit = await loadSimpleGit();
    const git = simpleGit(workspaceFolder);
  
    try {
      // Check if the folder is already a git repo
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        await git.init();
        vscode.window.showInformationMessage("✅ Git repository initialized.");
      } else {
        vscode.window.showInformationMessage("⚡ Git repository already exists.");
      }
  
      // Check if 'main' branch exists and switch to it if it does
      const branchSummary = await git.branchLocal();
      if (branchSummary.all.includes("main")) {
        await git.checkout("main");
      } else {
        await git.checkoutLocalBranch("main");
      }
  
      // Add and commit all files
      await git.add(".");
      await git.commit("Initial commit");
  
      // Get GitHub username dynamically
      if (!gitHubUsername) {
        await getGitHubUsername(); // Fetch username if not already set
      }
  
      // Set remote URL with authenticated username
      const repoUrl = `https://github.com/${gitHubUsername}/DailyWork.git`;
  
      // Check if 'origin' remote exists
      const remotes = await git.getRemotes();
      if (!remotes.find((r) => r.name === "origin")) {
        await git.remote(["add", "origin", repoUrl]);
        vscode.window.showInformationMessage(`✅ Remote 'origin' added: ${repoUrl}`);
      } else {
        await git.remote(["set-url", "origin", repoUrl]);
        vscode.window.showInformationMessage(`🔄 Remote URL updated to: ${repoUrl}`);
      }
  
      // Push to remote
      await git.push(["-u", "origin", "main"]);
  
      vscode.window.showInformationMessage(
        "✅ Repository initialized and pushed to GitHub."
      );
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Error initializing repository: ${error.message}`);
    }
  }
  
  
  

async function addBranch() {
    const workspaceFolder = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : null;
  
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No folder is opened in the workspace.");
      return;
    }
  
    const simpleGit = await loadSimpleGit();
    const git = simpleGit(workspaceFolder);
  
    try {
      let branchName = await getDirectory();
      if (!branchName) {
        return;
      }
  
      // Sanitize the branch name
      branchName = sanitizeBranchName(branchName);
      if (!branchName) {
        vscode.window.showErrorMessage("Invalid branch name after sanitization.");
        return;
      }
      
      const remotes = await git.getRemotes();
    if (!remotes.find((r) => r.name === "origin")) {
      if (!gitHubUsername) {
        await getGitHubUsername(); // Fetch username if not already set
      }
      const repoUrl = `https://github.com/${gitHubUsername}/DailyWork.git`;

      await git.remote(["add", "origin", repoUrl]);
      vscode.window.showInformationMessage(
        `✅ Remote 'origin' added: ${repoUrl}`
      );
    }
      // Check if branch exists
      const branchSummary = await git.branchLocal();
      if (branchSummary.all.includes(branchName)) {
        await git.checkout(branchName);
      } else {
        await git.checkoutLocalBranch(branchName);
      }
  
      // Add and commit changes
      await git.add(".");
      await git.commit(`Initial commit for branch: ${branchName}`);
      

      // Push to remote
      await git.push(["-u", "origin", branchName]);
  
      vscode.window.showInformationMessage(
        `🌳 Branch '${branchName}' added and pushed to Daily Work repo.`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `❌ Error creating branch: ${error.message}`
      );
    }
  }
  
  // Helper function to sanitize branch name
  function sanitizeBranchName(branchName) {
    return branchName
      .replace(/[^a-zA-Z0-9_.-]/g, "-") // Replace invalid characters
      .replace(/^-+|-+$/g, ""); // Remove trailing dashes
  }

// Extension activation
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("gitbolt.login", authenticate)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("gitbolt.listRepos", listRepositories)
  );
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri,
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("gitbolt.getDirectory", getDirectory)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("gitbolt.initRepo", initRepo)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("gitbolt.addBranch", addBranch)
  );

  vscode.window.showInformationMessage("GitBolt extension activated!");
}

// Extension deactivation
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
