import React from 'react';
import './CategoryCard.css';

const CategoryCard = ({ 
  id, 
  title, 
  subtitle, 
  icon, 
  commonParts, 
  onSelectCategory 
}) => {
  return (
    <div className="category-card" onClick={() => onSelectCategory(title)}>
      <div className="category-card-header">
        <div className="category-icon-wrapper">
          {icon}
        </div>
        <span className="category-badge">Catalog Preview</span>
      </div>

      <div className="category-card-body">
        <h3 className="category-title">{title}</h3>
        <p className="category-subtitle">{subtitle}</p>

        <div className="category-parts-preview">
          <span className="parts-label">Typical Spares:</span>
          <div className="parts-chips">
            {commonParts.map((part, index) => (
              <span key={index} className="part-chip">{part}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="category-card-footer">
        <span className="category-action-link">
          Explore {title} Parts
          <svg className="arrow-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </span>
      </div>
    </div>
  );
};

export default CategoryCard;
