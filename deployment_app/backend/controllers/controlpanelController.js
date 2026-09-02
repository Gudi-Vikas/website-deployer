import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

const deployController = async (req, res) => {
    const { gitUrl } = req.body;
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
        await cloneGit(deploymentDir, gitUrl);

        // Send clean response
        return res.status(200).json({
            success: true,
            deploymentId,
            message: "Repository cloned successfully"
        });

    } catch (error) {
        console.error(`[Deployment ${deploymentId}]`, error);

        // Remove incomplete deployment
        try {
            await fs.rm(deploymentDir, {
                recursive: true,
                force: true
            });
        } catch (cleanupError) {
            console.error(
                `[Cleanup ${deploymentId}]`,
                cleanupError
            );
        }

        return res.status(500).json({
            success: false,
            deploymentId,
            message: "Deployment failed"
        });
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