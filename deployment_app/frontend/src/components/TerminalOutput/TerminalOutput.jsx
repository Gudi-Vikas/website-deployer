import React, { useEffect, useRef } from 'react';
import styles from './TerminalOutput.module.css';

/**
 * TerminalOutput Component
 * Displays a mock terminal interface to show real-time deployment logs.
 * Automatically scrolls to the bottom as new logs are added.
 * 
 * @param {Object} props
 * @param {Array} props.logs - Array of log objects containing { type, message }
 */
const TerminalOutput = ({ logs }) => {
  // Reference to the bottom of the logs container for auto-scrolling
  const endOfLogsRef = useRef(null);

  // Auto-scroll to the bottom whenever the logs array changes
  useEffect(() => {
    if (endOfLogsRef.current) {
      endOfLogsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className={styles.terminalContainer}>
      {/* Fake macOS terminal window controls for aesthetic purposes */}
      <div className={styles.terminalHeader}>
        <div className={`${styles.terminalButton} ${styles.red}`}></div>
        <div className={`${styles.terminalButton} ${styles.yellow}`}></div>
        <div className={`${styles.terminalButton} ${styles.green}`}></div>
        <span className={styles.terminalTitle}>Deployment Output</span>
      </div>
      
      <div className={styles.terminalBody}>
        {logs.length === 0 ? (
          // Placeholder message before any logs arrive
          <div className={`${styles.terminalLine} ${styles.placeholder}`}>Waiting for deployment to start...</div>
        ) : (
          // Render each log entry, applying dynamic styles based on the log type (e.g., success, error, log)
          logs.map((log, index) => (
            <div key={index} className={`${styles.terminalLine} ${styles[log.type] || ''}`}>
              {log.message}
            </div>
          ))
        )}
        {/* Invisible div used as the target for auto-scrolling */}
        <div ref={endOfLogsRef} />
      </div>
    </div>
  );
};

export default TerminalOutput;
