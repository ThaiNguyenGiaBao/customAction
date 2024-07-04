const core = require('@actions/core')
const { wait } = require('./wait')
const github = require('@actions/github')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const ms = core.getInput('milliseconds', { required: true })

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Waiting ${ms} milliseconds ...`)

    // Log the current timestamp, wait, then log the new timestamp
    core.debug(new Date().toTimeString())
    await wait(parseInt(ms, 10))
    core.debug(new Date().toTimeString())

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())

    const owner = core.getInput('owner', { required: true })
    const repo = core.getInput('repo', { required: true })
    const pr_number = core.getInput('pr_number', { required: true })
    const token = core.getInput('token', { required: true })

    const octokit = github.getOctokit(token)

    const { data: pullRequest } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pr_number
    })

    const diffChange = {
      additions: 0,
      deletions: 0,
      changed_file: 0
    }
    const labels = []

    for (const file of pullRequest.files) {
      diffChange.additions += file.additions
      diffChange.deletions += file.deletions
      diffChange.changed_file++
      const fileExtension = file.filename.split('.').pop()
      let label = ''
      switch (fileExtension) {
        case 'js':
          label = 'JavaScript'
          break
        case 'json':
          label = 'JSON'
          break
        case 'md':
          label = 'Markdown'
          break
        case 'py':
          label = 'Python'
          break
        case 'yml':
          label = 'YAML'
          break
        default:
          label = 'Other'
      }
      labels.push(label)
    }

    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr_number,
      labels
    })
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pr_number,
      body: `
    Pull request #${pr_number} has be updated with: \n
    - ${diffChange.additions} additions\n
    - ${diffChange.deletions} deletions\n
    - ${diffChange.changed_file} changed files\n
  `
    })

    console.log(`
    Pull request #${pr_number} has be updated with: \n
    - ${diffChange.additions} additions\n
    - ${diffChange.deletions} deletions\n
    - ${diffChange.changed_file} changed files\n
  `)
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
