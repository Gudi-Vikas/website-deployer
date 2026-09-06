import { useState } from 'react';
import './App.css';

function App() {
  const [gitUrl, setGitUrl] = useState('');
  const [backendDir, setBackendDir] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!gitUrl) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch('http://localhost:4000/api/controlpanel/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 
        },
        body: JSON.stringify({ gitUrl, backendDir }),
      });

      const data = await res.json();
      setResponse({ status: res.status, data });
    } catch (error) {
      setResponse({
        status: 500,
        data: {
          success: false,
          message: 'Failed to connect to the server',
          error: error.message,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>Deploy App</h1>
        <p>Instantly clone and build your Node.js applications</p>
      </div>

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

      {response && (
        <div className={`response-box ${response.data.success ? 'success' : 'error'}`}>
          <div className="response-header">
            <div className="status-icon">
              {response.data.success ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
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
            
            {response.data.buildMessage && (
              <div className="detail-item">
                <span className="detail-label">Build Output:</span>
                <span className="detail-value">{response.data.buildMessage}</span>
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
  );
}

export default App;
