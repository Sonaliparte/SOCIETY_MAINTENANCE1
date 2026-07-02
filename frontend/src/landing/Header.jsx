import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  useMediaQuery
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import sgsLogo from '../../public/sgslogo.jpg';


const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const scrollTo = (id) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleDrawer = (open) => () => {
    setDrawerOpen(open);
  };

  const drawerList = (
    <Box sx={{ width: 250 }} role="presentation" onClick={toggleDrawer(false)}>
      <List>
        <ListItem button onClick={() => scrollTo('home')}>
          <ListItemText primary="Home" />
        </ListItem>
        <ListItem button onClick={() => scrollTo('about')}>
          <ListItemText primary="About" />
        </ListItem>
        <ListItem button onClick={() => scrollTo('contact')}>
          <ListItemText primary="Contact Us" />
        </ListItem>
        <Divider />
        {isAuthenticated ? (
          <>
            <ListItem button onClick={() => navigate('/')}>
              <ListItemText primary="Dashboard" />
            </ListItem>
            <ListItem button onClick={handleSignOut}>
              <ListItemText primary="Sign Out" />
            </ListItem>
          </>
        ) : (
          <ListItem button component={Link} to="/login">
            <ListItemText primary="Sign In" />
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={2}>
            <img
              src={sgsLogo}
              alt="SGS Logo"
              style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://placehold.co/60x60?text=Logo'; // Fallback if image fails to load
              }}
            />
            <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 'bold' }}>
              SHREE GURUDATTA SADAN
            </Typography>
          </Box>

          {isMobile ? (
            <>
              {isAuthenticated && user && (
                <IconButton color="inherit" sx={{ mr: 2 }}>
                  <Avatar alt={user.email} />
                </IconButton>
              )}
              <IconButton edge="end" color="inherit" onClick={toggleDrawer(true)}>
                <MenuIcon sx={{ color: '#000' }} />
              </IconButton>
              <Drawer anchor="right" open={drawerOpen} onClose={toggleDrawer(false)}>
                {drawerList}
              </Drawer>
            </>
          ) : (
            <Box display="flex" alignItems="center" gap={2}>
              {isAuthenticated && user && (
                <IconButton color="inherit" sx={{ mr: 2 }}>
                  <Avatar alt={user.email} />
                </IconButton>
              )}
              <Button onClick={() => scrollTo('home')} sx={{ color: '#475569', fontWeight: 'bold', fontSize: "15px", '&:hover': { color: '#0284c7' } }}>
                Home
              </Button>
              <Button onClick={() => scrollTo('about')} sx={{ color: '#475569', fontWeight: 'bold', fontSize: "15px", '&:hover': { color: '#0284c7' } }}>
                About
              </Button>
              <Button onClick={() => scrollTo('contact')} sx={{ color: '#475569', fontWeight: 'bold', fontSize: "15px", '&:hover': { color: '#0284c7' } }}>
                Contact Us
              </Button>

              {isAuthenticated ? (
                <>
                  <Button onClick={() => navigate('/')} sx={{ color: '#475569', fontWeight: 'bold', fontSize: "15px", '&:hover': { color: '#0284c7' } }}>
                    Dashboard
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSignOut}
                    sx={{
                      backgroundColor: '#ef4444', 
                      borderRadius: 2,
                      textTransform: 'none',
                      px: 3,
                      '&:hover': {
                        backgroundColor: '#dc2626',
                      },
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Link to="/login">
                  <Button
                    variant="contained"
                    sx={{
                      backgroundColor: '#0284c7',
                      borderRadius: 2,
                      textTransform: 'none',
                      px: 3,
                      '&:hover': {
                        backgroundColor: '#0369a1',
                      },
                    }}
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
    </>
  );
};

export default Header;
