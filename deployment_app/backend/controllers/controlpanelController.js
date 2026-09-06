import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { execFile, spawn } from "child_process";

const execFileAsync = promisify(execFile);
const spawnAsync = promisify(spawn);

const deployController = async (req, res) => {
    // Added a default empty string for backendDir in case it's deployed from the root
    const { gitUrl, backendDir = "" } = req.body;
    const deploymentId = randomUUID();

    const deploymentDir = path.join(
        process.cwd(),
        "deployments",
        deploymentId
    );

    // Validate input
    if (!gitUrl || typeof gitUrl !== "string") {
        return res.status(400).json({
            success: false,
            message: "gitUrl is required"
        });
    }

    try {
        // Create deployment directory
        await fs.mkdir(deploymentDir, { recursive: true });

        // Clone repository
        console.log(`[Deployment ${deploymentId}] Cloning repository...`);
        await cloneGit(deploymentDir, gitUrl);

        // Define the target directory for the Node build
        const nodeDir = path.join(deploymentDir, backendDir);

        // Run the build process
        console.log(`[Deployment ${deploymentId}] Starting Node build...`);
        const build = await nodeBuild(nodeDir);

        // If the build fails, throw an error to trigger the cleanup catch block
        if (!build.success) {
            throw new Error(`Build step failed: ${build.error}`);
        }

        // Send clean response only after clone AND build succeed
        return res.status(200).json({
            success: true,
            deploymentId,
            message: "Repository cloned and built successfully",
            buildMessage: build.message
        });

    } catch (error) {
        console.error(`[Deployment ${deploymentId}]`, error);

        // Remove incomplete/failed deployment
        try {
            await fs.rm(deploymentDir, {
                recursive: true,
                force: true
            });
            console.log(`[Cleanup ${deploymentId}] Directory removed successfully.`);
        } catch (cleanupError) {
            console.error(
                `[Cleanup ${deploymentId}] Failed to remove directory:`,
                cleanupError
            );
        }

        return res.status(500).json({
            success: false,
            deploymentId,
            message: "Deployment failed",
            error: error.message
        });
    }
};

const nodeBuild = async (deploymentDir) => {
    try {
        // Pre-flight check: Ensure the target directory actually exists 
        // Prevents misleading ENOENT errors if backendDir is wrong
        try {
            await fs.access(deploymentDir);
        } catch (err) {
            throw new Error(`Deployment directory does not exist: ${deploymentDir}. Check if backendDir is correct.`);
        }

        // Step 1: Install dependencies (npm install)
        console.log("Installing dependencies...");
        console.log("PATH:", process.env.PATH);
        await new Promise((resolve, reject) => {
            const child = spawn("npm", ["install"], {//Start the /bin/bash program as a child process. -c tells bash to exectue next string as a command
                env: { ...process.env },// Preserves your system's PATH ... this sends env of my current parent nodejs env variables also .. system env contains paths for executable files like npm npx etc.
                // By using the spread operator (...process.env), you are passing a complete copy of every environment variable from your parent Node process down to the child process ... if you want pass only env like PATH: process.env.PATH, "key":"path/value"
                // PORT: '3000'     Adds your custom varible like env difined by the user
                cwd: deploymentDir,
                shell: false, // Ensures that the command runs in a shell environment, which is often necessary for commands like npm to work correctly across different operating systems.
                stdio: 'inherit' // Streams the child process output (stdout/stderr) directly to your console
            });

            child.on("error", reject);
 
            child.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`npm install failed with exit code ${code}`));
                }
            });
        });

        // Step 2: Run the build script (npm run build) || node server.js
        console.log("starting project...");
        
        spawn("node", ["server.js"], { //no await becoz it should run in bg node logs are continous
            env: { ...process.env },
            cwd: deploymentDir,
            shell: false, 
            stdio: 'inherit' // Streams the build logs in real-time
        });

        console.log("project started succesfully.");
        
        // Return success status and a message to the caller
        return { 
            success: true, 
            message: "Build completed successfully." 
        };
        
    } catch (error) {
        console.error("Build process failed:", error);
        
        // Return failure status and the error so the caller can handle it
        return { 
            success: false, 
            error: error.message || error 
        };
    }
};

const cloneGit = async (deploymentDir, gitUrl) => {
    try {
        const { stdout, stderr } = await execFileAsync(
            "git",
            ["clone", gitUrl, deploymentDir],
            {
                timeout: 120000,
                maxBuffer: 10 * 1024 * 1024
            }
        );

        // Keep terminal output on server
        console.log("Git stdout:", stdout);
        console.log("Git stderr:", stderr);

        return { stdout, stderr };

    } catch (error) {
        console.error("Git clone error:", {
            message: error.message,
            stdout: error.stdout,
            stderr: error.stderr
        });

        throw error;
    }
};

export { deployController };