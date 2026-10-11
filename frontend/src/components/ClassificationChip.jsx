import React from 'react';
import { CLASSIFICATION_STYLE } from '../theme';

const ClassificationChip = ({ classification }) => {
  const style = CLASSIFICATION_STYLE[classification] || CLASSIFICATION_STYLE.Overloaded;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', background: style.bg, color: style.fg,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', border: `1px solid ${style.border}`
    }}>
      {classification}
    </span>
  );
};

export default ClassificationChip;
