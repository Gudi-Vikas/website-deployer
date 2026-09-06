import { useState } from 'react';
import './App.css';
import TerminalOutput from './components/TerminalOutput/TerminalOutput';

/**
 * Main Application Component
 * Provides a UI to trigger backend deployments and visualize real-time logs.
 */
function App() {
  // Form state
  const [gitUrl, setGitUrl] = useState('');
  const [backendDir, setBackendDir] = useState('');
  
  // UI state for loading indicators
  const [isLoading, setIsLoading] = useState(false);
  
  // State for the final deployment response (success/error details)
  const [response, setResponse] = useState(null);
  
  // State to accumulate real-time logs from the server
  const [logs, setLogs] = useState([]);

  /**
   * Handles the form submission to trigger a new deployment.
   * Connects to the backend via Server-Sent Events (SSE) to receive live logs.
   */
  const handleDeploy = (e) => {
    e.preventDefault();
    if (!gitUrl) return;

    // Reset UI state for a new deployment
    setIsLoading(true);
    setResponse(null);
    setLogs([]);

    // Construct query parameters for the SSE request
    const queryParams = new URLSearchParams({
      gitUrl: gitUrl,
      backendDir: backendDir
    }).toString();

    // Establish an SSE connection using the native EventSource API
    // Note: The backend must support GET requests for this endpoint
    const eventSource = new EventSource(`http://localhost:4000/api/controlpanel/deploy?${queryParams}`);

    // Listen for incoming messages from the server
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data); // convert the string data back to an object
        
        // Append the new log to the existing logs array
        setLogs((prevLogs) => [...prevLogs, data]);

        // Check if this is the final message indicating success or failure
        if (data.type === 'success' || (data.type === 'error' && data.success === false)) {
          // Update the final response state to display the summary box
          setResponse({
            status: data.success ? 200 : 500,
            data: data
          });
          setIsLoading(false);
          
          // If the deployment failed, close the connection immediately.
          // (On success, we keep it open in case the server continues sending background logs)
          if (data.type === 'error') {
            eventSource.close();
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    // Handle connection errors or unexpected disconnects
    eventSource.onerror = (error) => {
      console.error("EventSource failed:", error);
      eventSource.close();
      setIsLoading(false);
      
      // If we haven't received a final response yet, set a generic error message
      setResponse((prev) => {
        if (!prev) {
          return {
            status: 500,
            data: {
              success: false,
              message: 'Connection lost or failed to connect to the server',
            }
          };
        }
        return prev;
      });
    };
  };

  return (
    <div className="app-container">
      <div className="left-panel">
        <div className="header">
          <h1>Deploy App</h1>
          <p>Instantly clone and build your Node.js applications</p>
        </div>

        {/* Deployment Configuration Form */}
        <form className="deploy-form" onSubmit={handleDeploy}>
        <div className="form-group">
          <label htmlFor="gitUrl">GitHub Repository URL *</label>
          <input
            type="url"
            id="gitUrl"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="https://github.com/username/repo.git"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="backendDir">Backend Directory (Optional)</label>
          <input
            type="text"
            id="backendDir"
            value={backendDir}
            onChange={(e) => setBackendDir(e.target.value)}
            placeholder="e.g. backend or server"
            disabled={isLoading}
          />
        </div>

        <button type="submit" className="submit-btn" disabled={isLoading || !gitUrl}>
          {isLoading ? (
            <>
              <div className="loader"></div>
              Deploying...
            </>
          ) : (
            'Deploy Now'
          )}
        </button>
      </form>
      </div>

      <div className="right-panel">
        {/* Real-time Terminal Output Console */}
        {(logs.length > 0 || isLoading) && (
          <TerminalOutput logs={logs} />
        )}

      {/* Final Deployment Summary Box */}
      {response && (
        <div className={`response-box ${response.data.success ? 'success' : 'error'}`}>
          <div className="response-header">
            <div className="status-icon">
              {response.data.success ? (
                // Checkmark icon for success
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                // X icon for failure
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              )}
            </div>
            <h3>{response.data.success ? 'Deployment Successful' : 'Deployment Failed'}</h3>
          </div>
          
          <div className="response-details">
            <div className="detail-item">
              <span className="detail-label">Message:</span>
              <span>{response.data.message}</span>
            </div>
            
            {response.data.deploymentId && (
              <div className="detail-item">
                <span className="detail-label">Deployment ID:</span>
                <span className="detail-value">{response.data.deploymentId}</span>
              </div>
            )}
            
            {response.data.error && (
              <div className="detail-item">
                <span className="detail-label">Error Details:</span>
                <span className="detail-value">{response.data.error}</span>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
