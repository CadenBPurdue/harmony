// src/renderer/App.jsx
import React from 'react';
import { Button, Container, Typography } from '@mui/material';

function App() {
  const handleClick = () => {
    alert('Button clicked!');
  };

  return (
    <Container>
      <Typography variant="h4" sx={{ mt: 4, mb: 2 }}>
        Welcome to Harmony
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 4 }}>
        Authors: Adam Kahl, Caden Brennan, Ethan Burmane
      </Typography>
      <Button variant="contained" onClick={handleClick}>
        Click Me
      </Button>
    </Container>
  );
}

export default App;
