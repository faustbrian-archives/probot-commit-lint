import { lint, load } from "@commitlint/core";
import { Context, Octokit } from "probot";

const formatCommits = (commits: any[], countErrors: number, countWarnings: number): string => {
	let body: string = "";

	for (const commit of commits) {
		body += `* Commit: ${commit.sha}\n`;
		body += commit.errors.map(e => `  - :x: ${e.message}\n`).join("");
		body += commit.warnings.map(w => `  - :warning: ${w.message}\n`).join("");
	}

	return `
Found ${countErrors} problems, ${countWarnings} warnings within this pull request.

${body}

You may need to [change a commit messages][https://help.github.com/en/articles/changing-a-commit-message] to comply with the contribution guidelines.
`;
};

export const performLint = async (context: Context): Promise<void> => {
	const pullRequest: { owner: string; repo: string; pull_number: number } = context.repo({
		pull_number: context.issue().number,
	});

	const issue: { owner: string; repo: string; issue_number: number } = context.repo({
		issue_number: context.issue().number,
	});

	const repo: { owner: string; repo: string } = context.repo();

	const statusInfo: { owner: string; repo: string; sha: string; context: string } = {
		...repo,
		sha: context.payload.pull_request.head.sha,
		context: process.env.APP_NAME,
	};

	await context.github.repos.createStatus({
		...statusInfo,
		state: "pending",
		description: "Waiting for the status to be reported",
	});

	await context.github.paginate(
		context.github.pulls.listCommits.endpoint.merge(pullRequest),
		async ({ data: commits }) => {
			const report: { valid: boolean; commits: Array<{ sha: string; errors: string[]; warnings: string[] }> } = {
				valid: true,
				commits: [],
			};

			const { rules } = await load({ extends: ["@commitlint/config-conventional"] });

			let countErrors: number = 0;
			let countWarnings: number = 0;

			for (const commit of commits) {
				const { valid, errors, warnings } = await lint(commit.commit.message, rules);
				if (!valid) {
					report.valid = false;
				}

				if (errors.length > 0 || warnings.length > 0) {
					countErrors += errors.length;
					countWarnings += warnings.length;

					report.commits.push({
						sha: commit.sha,
						errors,
						warnings,
					});
				}
			}

			await context.github.repos.createStatus({
				...statusInfo,
				state: report.valid ? "success" : "failure",
				description: `Found ${countErrors} problems, ${countWarnings} warnings`,
			});

			const previousComment: Octokit.IssuesListCommentsResponseItem = (await context.github.issues.listComments(
				issue,
			)).data.find(comment => comment.user.login === `${process.env.APP_NAME}[bot]`);

			if (countErrors || countWarnings) {
				const message: string = formatCommits(report.commits, countErrors, countWarnings);

				if (previousComment) {
					await context.github.issues.updateComment({
						...pullRequest,
						comment_id: previousComment.id,
						body: message,
					});
				} else {
					await context.github.issues.createComment({
						...context.repo({ issue_number: context.issue().number }),
						body: message,
					});
				}
			} else {
				if (previousComment) {
					await context.github.issues.deleteComment({
						...pullRequest,
						comment_id: previousComment.id,
					});
				}
			}
		},
	);
};
