import React from 'react';
import { Box, Stack, Typography, Grid } from '@mui/material';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PaymentsIcon from '@mui/icons-material/Payments';
import DownloadIcon from '@mui/icons-material/Download';

const steps = [
  {
    icon: <TouchAppIcon sx={{ fontSize: 60, color:'#0284c7',}} />,
    text: 'Click on\nPayment option',
  },
  {
    icon: <EditNoteIcon sx={{ fontSize: 60, color:'#0284c7'}} />,
    text: 'Fill-up all\ndetails',
  },
  {
    icon: <PaymentsIcon sx={{ fontSize: 60, color:'#0284c7' }} />,
    text: 'Click on\nPayment button',
  },
  {
    icon: <DownloadIcon sx={{ fontSize: 60, color:'#0284c7' }} />,
    text: 'Download\nReceipt',
  },
];

const About = () => {
  return (
    <Box sx={{ p: 10, textAlign: 'center', backgroundColor: '#ffffff', color: '#0f172a' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Getting started is quick and easy
      </Typography>

      <Grid container spacing={4} justifyContent="center" mt={10}>
        {steps.map((step, i) => (
          <Grid item xs={9} sm={3} key={i}>
            <Box>
              {step.icon}
              <Typography gap={10} variant="subtitle1" mt={2} fontWeight="bold" >
                {step.text}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default About;
