const vscode = require("vscode");
const { authenticate,handleUri,listRepositories,initRepo,addBranch,getDirectory,getGitHubUsername,initializeOctokit } = require("./gitBoltCommands/commands");




// Extension activation
async function activate(context) {
    await initializeOctokit(context);
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
  context.subscriptions.push(
    vscode.commands.registerCommand("gitbolt.getusername", getGitHubUsername)
  );

  vscode.window.showInformationMessage("GitBolt extension activated!");
}

// Extension deactivation
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};