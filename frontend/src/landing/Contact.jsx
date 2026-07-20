import React, { useState } from "react";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    building_name: '',
    email: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit  = async (e) => {
    e.preventDefault();
    console.log("Submit clicked", formData);
  
    try {
      const res = await fetch(`https://formsubmit.co/ajax/sonaliparte45@gmail.com`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });
  
      const data = await res.json();
      console.log('Response from FormSubmit:', data);
      alert("Message sent successfully!");
  
      setFormData({
        name: '',
        building_name: '',
        email: '',
        message: ''
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Something went wrong. Please try again.");
    }
  };
  
  return (
    <div style={styles.wrapper} id="contact">
      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.heading}>Contact Us</h2>

        <label style={styles.label}>Name:</label>
        <input
          type="text"
          name="name"
          style={styles.input}
          placeholder="Enter your name"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <label style={styles.label}>Building Name:</label>
        <input
          type="text"
          name="building_name"
          style={styles.input}
          placeholder="Enter your building name"
          value={formData.building_name}
          onChange={handleChange}
          required
        />

        <label style={styles.label}>Email:</label>
        <input
          type="email"
          name="email"
          style={styles.input}
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <label style={styles.label}>Message:</label>
        <textarea
          name="message"
          style={styles.textarea}
          placeholder="Write your message"
          value={formData.message}
          onChange={handleChange}
          required
        />

        <button style={styles.button} type="submit">Submit</button>
      </form>
    </div>
  );
};

const styles = {
  wrapper: {
    backgroundColor: '#f8fafc',
    padding: '80px 0',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: "0",
  },
  form: {
    backgroundColor: '#ffffff',
    padding: '50px',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '700px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  heading: {
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: '30px',
    fontSize: '30px',
    fontWeight: 'bold',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    color: '#334155',
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '20px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '16px',
    backgroundColor: '#f8fafc',
  },
  textarea: {
    width: '100%',
    height: '120px',
    padding: '12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '16px',
    marginBottom: '20px',
    backgroundColor: '#f8fafc',
    fontFamily: 'inherit',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#0284c7',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.3s ease',
  }
};

export default Contact;
