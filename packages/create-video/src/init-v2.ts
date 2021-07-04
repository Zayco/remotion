import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import path from 'path';
import stripAnsi from 'strip-ansi';
import * as CreateDirectory from './create-directory';
import {Log} from './log';
import prompts, {selectAsync} from './prompts';

type TEMPLATES = {
	shortName: string;
	name: string;
	description: string;
};

const FEATURED_TEMPLATES: TEMPLATES[] = [
	{
		shortName: 'Hello World',
		name: 'template-helloworld',
		description: 'The default starter template (recommended)',
	},
	{
		shortName: 'Helloworld (Javascript)',
		name: 'template-helloworld-javascript',
		description: 'The default starter template in plain JS',
	},
	{
		shortName: 'Three Fiber template',
		name: 'template-three',
		description: 'Remotion + React Three Fiber Starter Template',
	},
];

function padEnd(str: string, width: number): string {
	// Pulled from commander for overriding
	const len = Math.max(0, width - stripAnsi(str).length);
	return str + Array(len + 1).join(' ');
}

function assertValidName(folderName: string) {
	const validation = CreateDirectory.validateName(folderName);
	if (typeof validation === 'string') {
		throw new Error(
			`Cannot create an app named ${chalk.red(
				`"${folderName}"`
			)}. ${validation}`
		);
	}
}

async function assertFolderEmptyAsync(
	projectRoot: string,
	folderName?: string
) {
	if (
		!(await CreateDirectory.assertFolderEmptyAsync({
			projectRoot,
			folderName,
			overwrite: false,
		}))
	) {
		const message = 'Try using a new directory name, or moving these files.';
		Log.newLine();
		Log.info(message);
		Log.newLine();
		throw new Error(message);
	}
}

const shouldUseYarn = (): boolean => {
	return Boolean(
		process.env.npm_execpath?.includes('yarn.js') ||
			process.env.npm_config_user_agent?.includes('yarn')
	);
};

const isGitExecutableAvailable = async () => {
	try {
		await execa('git', ['--version']);
		return true;
	} catch (e) {
		if (e.errno === 'ENOENT') {
			Log.warn('Unable to find `git` command. `git` not in PATH.');
			return false;
		}
	}
};

const initGitRepoAsync = async (
	root: string,
	flags: {silent: boolean; commit: boolean} = {silent: false, commit: true}
) => {
	// let's see if we're in a git tree
	try {
		await execa('git', ['rev-parse', '--is-inside-work-tree'], {
			cwd: root,
		});
		!flags.silent &&
			Log.info(
				'New project is already inside of a git repo, skipping git init.'
			);
	} catch (e) {
		if (e.errno === 'ENOENT') {
			!flags.silent &&
				Log.warn('Unable to initialize git repo. `git` not in PATH.');
			return false;
		}
	}

	// not in git tree, so let's init
	try {
		await execa('git', ['init'], {cwd: root});
		!flags.silent && Log.info('Initialized a git repository.');

		if (flags.commit) {
			await execa('git', ['add', '--all'], {cwd: root, stdio: 'ignore'});
			await execa('git', ['commit', '-m', 'Create a new Remotion app'], {
				cwd: root,
				stdio: 'ignore',
			});
			await execa('git', ['branch', '-M', 'main'], {
				cwd: root,
				stdio: 'ignore',
			});
		}
		return true;
	} catch (e) {
		Log.verbose('git error:', e);
		// no-op -- this is just a convenience and we don't care if it fails
		return false;
	}
};

const resolveProjectRootAsync = async () => {
	let projectName = '';
	try {
		const {answer} = await prompts({
			type: 'text',
			name: 'answer',
			message: 'What would you like to name your app?',
			initial: 'my-video',
			validate: (name) => {
				const validation = CreateDirectory.validateName(
					path.basename(path.resolve(name))
				);
				if (typeof validation === 'string') {
					return 'Invalid project name: ' + validation;
				}
				return true;
			},
		});

		if (typeof answer === 'string') {
			projectName = answer.trim();
		}
	} catch (error) {
		// Handle the aborted message in a custom way.
		if (error.code !== 'ABORTED') {
			throw error;
		}
	}

	const projectRoot = path.resolve(projectName);
	const folderName = path.basename(projectRoot);

	assertValidName(folderName);

	await fs.ensureDir(projectRoot);

	await assertFolderEmptyAsync(projectRoot, folderName);

	return [projectRoot, folderName];
};

const isNodeVersionGreater = () => {
	return process.versions.node >= '16.0.0';
};

export const init = async () => {
	// let projectName = process.argv[2];
	// Log.info(projectName, 'new');
	const [projectRoot, folderName] = await resolveProjectRootAsync();
	const greaterNodeVersion = isNodeVersionGreater();
	await isGitExecutableAvailable();

	const descriptionColumn =
		Math.max(
			...FEATURED_TEMPLATES.map((t) =>
				typeof t === 'object' ? t.shortName.length : 0
			)
		) + 2;

	const template = await selectAsync(
		{
			message: 'Choose a template:',
			optionsPerPage: 20,
			choices: FEATURED_TEMPLATES.map((template) => {
				if (typeof template === 'string') {
					return prompts.separator(template);
				} else {
					return {
						value: template.name,
						title:
							chalk.bold(padEnd(template.shortName, descriptionColumn)) +
							template.description.trim(),
						short: template.name,
					};
				}
			}),
		},
		{}
	);

	await execa('git', [
		'clone',
		`https://github.com/remotion-dev/${template}`,
		projectRoot,
	]);

	if (greaterNodeVersion) {
		fs.rmSync(path.join(projectRoot, '.git'), {recursive: true});
	} else {
		fs.rmdirSync(path.join(projectRoot, '.git'), {recursive: true});
	}

	await initGitRepoAsync(projectRoot, {
		silent: true,
		commit: true,
	});

	Log.info(
		`Created project at ${chalk.blue(folderName)}. Installing dependencies...`
	);
	if (shouldUseYarn()) {
		Log.info('> yarn');
		const promise = execa('yarn', [], {
			cwd: projectRoot,
		});
		promise.stderr?.pipe(process.stderr);
		promise.stdout?.pipe(process.stdout);
		await promise;
	} else {
		Log.info('> npm install');
		const promise = execa('npm', ['install'], {
			cwd: projectRoot,
		});
		promise.stderr?.pipe(process.stderr);
		promise.stdout?.pipe(process.stdout);
		await promise;
	}
	Log.info(`Welcome to ${chalk.blue('Remotion')}!`);
	Log.info(`✨ Your video has been created at ${chalk.blue(folderName)}.\n`);

	Log.info('Get started by running');
	Log.info(chalk.blue(`cd ${folderName}`));
	Log.info(chalk.blue(shouldUseYarn() ? 'yarn start' : 'npm start'));
	Log.info('');
	Log.info('To render an MP4 video, run');
	Log.info(chalk.blue(shouldUseYarn() ? 'yarn build' : 'npm run build'));
	Log.info('');
	Log.info(
		'Read the documentation at',
		chalk.underline('https://remotion.dev')
	);
	Log.info('Enjoy Remotion!');
};
