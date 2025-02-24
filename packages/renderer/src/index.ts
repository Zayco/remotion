import {TAsset, TCompMetadata} from 'remotion';
import {
	ffmpegHasFeature,
	getFfmpegBuildInfo,
	getFfmpegVersion,
} from './ffmpeg-flags';
import {getActualConcurrency} from './get-concurrency';
import {ensureLocalBrowser} from './get-local-browser-executable';
import {openBrowser} from './open-browser';
import {binaryExists, validateFfmpeg} from './validate-ffmpeg';

declare global {
	interface Window {
		ready: boolean;
		getStaticCompositions: () => TCompMetadata[];
		remotion_setFrame: (frame: number) => void;
		remotion_collectAssets: () => TAsset[];
	}
}

export {FfmpegVersion} from './ffmpeg-flags';
export {getCompositions} from './get-compositions';
export {
	OnErrorInfo,
	OnStartData,
	renderFrames,
	RenderFramesOutput,
} from './render';
export {stitchFramesToVideo} from './stitcher';
export const RenderInternals = {
	ensureLocalBrowser,
	ffmpegHasFeature,
	getActualConcurrency,
	getFfmpegVersion,
	openBrowser,
	validateFfmpeg,
	binaryExists,
	getFfmpegBuildInfo,
};
