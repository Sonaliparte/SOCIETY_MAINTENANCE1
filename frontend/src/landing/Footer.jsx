import React from 'react';

const Footer = () => {
  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <p style={styles.text}>© {new Date().getFullYear()} SECURIX. All rights reserved.</p>
        <p style={styles.text}>Designed by You ❤️</p>
      </div>
    </footer>
  );
};

const styles = {
  footer: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    padding: '30px 0',
    marginTop: '0',
    width: '100%',
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 20px',
    textAlign: 'center',
  },
  text: {
    margin: '5px 0',
    fontSize: '14px',
  }
};

export default Footer;
