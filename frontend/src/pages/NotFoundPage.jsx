import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

const NotFoundPage = () => {
  return (
    <div className="notfound-page-root">
      <div className="container notfound-container">
        <div className="notfound-card">
          <div className="notfound-code">404</div>
          <h1 className="notfound-title">Page Not Found</h1>
          <p className="notfound-desc">
            The page you are looking for doesn't exist on EXACTSPARE or has been moved.
          </p>
          <div className="notfound-actions">
            <Link to="/" className="btn btn-primary">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
