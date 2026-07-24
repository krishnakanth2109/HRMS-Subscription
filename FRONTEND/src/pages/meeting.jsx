import React, { useState } from 'react';
import axios from 'axios';
import { baseURL } from '../api';

const MeetingGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [error, setError] = useState('');

  // 1. Define your Base URL (matches your server port)
  const API_BASE_URL = `${baseURL}/api/meetings`;

  const createMeeting = async () => {
    setLoading(true);
    setError('');
    setMeetingLink('');

    try {
      // ✅ UPDATED URL: Now includes /api/meetings
      const response = await axios.post(`${API_BASE_URL}/create-meeting`);
      
      if (response.data.link) {
        setMeetingLink(response.data.link);
      }
    } catch (err) {
      // If server returns 401, it means we need to login to Google first
      if (err.response && err.response.status === 401) {
        authorizeGoogle();
      } else {
        console.error(err);
        setError('Failed to generate meeting. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const authorizeGoogle = async () => {
    try {
      // ✅ UPDATED URL: Now includes /api/meetings
      const res = await axios.get(`${API_BASE_URL}/auth/url`);
      
      // Redirect user to Google Login
      window.open(res.data.url, '_blank');
      setError('Please authenticate in the popup window, then click "Create Google Meet" again.');
    } catch (e) {
      console.error(e);
      setError('Could not connect to authentication server.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingLink);
    alert("Link Copied!");
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.header}>HRMS Meeting Scheduler</h3>
      
      <p style={styles.text}>
        Click below to generate a real-time Google Meet link for the candidate.
      </p>

      {/* Action Button */}
      <button 
        onClick={createMeeting} 
        disabled={loading}
        style={loading ? styles.disabledButton : styles.button}
      >
        {loading ? 'Generating Link...' : 'Create Google Meet'}
      </button>

      {/* Error Message */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Success Display */}
      {meetingLink && (
        <div style={styles.resultBox}>
          <p style={styles.label}>Meeting Created Successfully:</p>
          <a href={meetingLink} target="_blank" rel="noopener noreferrer" style={styles.link}>
            {meetingLink}
          </a>
          <button onClick={copyToClipboard} style={styles.copyBtn}>
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
};

// Simple inline styles
const styles = {
  card: {
    border: '1px solid #ddd',
    borderRadius: '12px',
    padding: '25px',
    maxWidth: '400px',
    margin: '20px auto',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#fff',
    textAlign: 'center'
  },
  header: { margin: '0 0 10px 0', color: '#333' },
  text: { color: '#666', fontSize: '14px', marginBottom: '20px' },
  button: {
    backgroundColor: '#007bff', color: 'white', padding: '12px 24px',
    border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer',
    width: '100%', transition: 'background 0.3s'
  },
  disabledButton: {
    backgroundColor: '#ccc', color: 'white', padding: '12px 24px',
    border: 'none', borderRadius: '6px', fontSize: '16px',
    width: '100%', cursor: 'not-allowed'
  },
  error: { color: 'red', marginTop: '15px', fontSize: '14px' },
  resultBox: {
    marginTop: '20px', padding: '15px', backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd', borderRadius: '8px', textAlign: 'left'
  },
  label: { margin: '0 0 5px 0', fontSize: '12px', color: '#555', fontWeight: 'bold' },
  link: {
    display: 'block', color: '#0284c7', textDecoration: 'none',
    marginBottom: '10px', whiteSpace: 'nowrap', overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  copyBtn: {
    padding: '5px 10px', fontSize: '12px', cursor: 'pointer',
    backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px'
  }
};

export default MeetingGenerator;