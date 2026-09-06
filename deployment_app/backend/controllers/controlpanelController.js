import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { spawn } from "child_process";


const deployController = async (req, res) => {
    // Support parameters from body or query to allow EventSource or fetch
    const gitUrl = req.body?.gitUrl || req.query?.gitUrl;
    const backendDir = req.body?.backendDir || req.query?.backendDir || "";
    const deploymentId = randomUUID();

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // establish SSE connection immediately

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`); // sse only supports string data with UTF-8 encoding, so we stringify the object
    };

    // Validate input
    if (!gitUrl || typeof gitUrl !== "string") {
        sendEvent({
            type: 'error',
            success: false,
            message: "gitUrl is required"
        });
        return res.end();
    }

    const deploymentDir = path.join(
        process.cwd(),
        "deployments",
        deploymentId
    );

    try {
        // Create deployment directory
        await fs.mkdir(deploymentDir, { recursive: true });

        // Clone repository
        sendEvent({ type: 'log', message: `[Deployment ${deploymentId}] Cloning repository...` });
        await cloneGit(deploymentDir, gitUrl, sendEvent);

        // Define the target directory for the Node build
        const nodeDir = path.join(deploymentDir, backendDir);

        // Run the build process
        sendEvent({ type: 'log', message: `[Deployment ${deploymentId}] Starting Node build...` });
        const build = await nodeBuild(nodeDir, sendEvent);

        // If the build fails, throw an error to trigger the cleanup catch block
        if (!build.success) {
            throw new Error(`Build step failed: ${build.error}`);
        }

        // Send success message, but keep the connection open to stream background node logs
        sendEvent({
            type: 'success',
            success: true,
            deploymentId,
            message: "Repository cloned and built successfully",
            buildMessage: build.message
        });

    } catch (error) {
        sendEvent({ type: 'error', message: `[Deployment ${deploymentId}] Error: ${error.message}` });

        // Remove incomplete/failed deployment
        try {
            await fs.rm(deploymentDir, {
                recursive: true,
                force: true
            });
            sendEvent({ type: 'log', message: `[Cleanup ${deploymentId}] Directory removed successfully.` });
        } catch (cleanupError) {
            sendEvent({ type: 'error', message: `[Cleanup ${deploymentId}] Failed to remove directory: ${cleanupError.message}` });
        }

        sendEvent({
            type: 'error',
            success: false,
            deploymentId,
            message: "Deployment failed",
            error: error.message
        });
        res.end(); // Close connection on failure
    }

    req.on("close", () => {
        console.log(`[Deployment ${deploymentId}] Client disconnected from SSE`);
    });
};

const nodeBuild = async (deploymentDir, sendEvent) => {
    try {
        // Pre-flight check: Ensure the target directory actually exists 
        try {
            await fs.access(deploymentDir);
        } catch (err) {
            throw new Error(`Deployment directory does not exist: ${deploymentDir}. Check if backendDir is correct.`);
        }

        // Step 1: Install dependencies (npm install)
        sendEvent({ type: 'log', message: "Installing dependencies..." });
        await new Promise((resolve, reject) => {
            const child = spawn("npm", ["install"], {
                env: { ...process.env },
                cwd: deploymentDir,
                shell: false
            });

            child.stdout.on('data', (data) => {
                sendEvent({ type: 'log', message: data.toString() });
            });
            child.stderr.on('data', (data) => { // Capture and send error output from npm install
                sendEvent({ type: 'error', message: data.toString() });
            });

            child.on("error", reject); // Handle errors from spawning the process
 
            child.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`npm install failed with exit code ${code}`));
                }
            });
        });

        // Step 2: Run the build script (node server.js)
        sendEvent({ type: 'log', message: "starting project..." });
        
        const nodeProcess = spawn("node", ["server.js"], { 
            env: { ...process.env },
            cwd: deploymentDir,
            shell: false
        });

        nodeProcess.stdout.on('data', (data) => {
            sendEvent({ type: 'log', message: data.toString() });
        });
        nodeProcess.stderr.on('data', (data) => {
            sendEvent({ type: 'error', message: data.toString() });
        });

        sendEvent({ type: 'log', message: "project started succesfully." });
        
        return { 
            success: true, 
            message: "Build completed successfully." 
        };
        
    } catch (error) {
        sendEvent({ type: 'error', message: "Build process failed: " + error.message });
        
        return { 
            success: false, 
            error: error.message || error 
        };
    }
};

const cloneGit = async (deploymentDir, gitUrl, sendEvent) => {
    try {
        await new Promise((resolve, reject) => {
            const child = spawn("git", ["clone", gitUrl, deploymentDir], {
                timeout: 120000
            });

            child.stdout.on('data', (data) => {
                sendEvent({ type: 'log', message: data.toString() });
            });
            
            child.stderr.on('data', (data) => {
                sendEvent({ type: 'log', message: data.toString() });
            });

            child.on('error', reject);
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Git clone failed with exit code ${code}`));
                }
            });
        });

    } catch (error) {
        sendEvent({ type: 'error', message: `Git clone error: ${error.message}` });
        throw error;
    }
};

export { deployController };