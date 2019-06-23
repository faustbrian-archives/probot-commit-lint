import { Application } from "probot";
import { performLint } from "./app";

export = async (robot: Application) => {
	robot.on("pull_request.opened", performLint);
	robot.on("pull_request.synchronize", performLint);
};
