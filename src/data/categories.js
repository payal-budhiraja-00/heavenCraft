// Categories and subcategories configuration
export const categories = [
  {
    id: 'chair',
    name: 'Chairs',
    description: 'Ergonomic office chairs for comfort and productivity',
    icon: '🪑',
    subcategories: [
      {
        id: 'mesh-chair',
        name: 'Mesh Chair',
        description: 'Breathable mesh chairs for all-day comfort'
      },
      {
        id: 'fabric-chair',
        name: 'Fabric Chair',
        description: 'Comfortable fabric upholstered chairs with excellent support'
      },
      {
        id: 'leather-chair',
        name: 'Leather Chair',
        description: 'Premium leather chairs for executive offices'
      },
      {
        id: 'gaming-chair',
        name: 'Gaming Chair',
        description: 'Gaming-style chairs for work and play'
      },
      {
        id: 'training-chair',
        name: 'Training Chair',
        description: 'Space-efficient stackable chairs ideal for training and meeting rooms'
      },
      {
        id: 'recliner-chair',
        name: 'Recliner Chair',
        description: 'Reclining chairs for ultimate relaxation'
      }
    ]
  },
  {
    id: 'table',
    name: 'Tables',
    description: 'Ergonomic desks and tables for every workspace',
    icon: '🗄️',
    subcategories: [
      {
        id: 'bed-table',
        name: 'Bed Table',
        description: 'Portable tables for bed or couch use'
      },
      {
        id: 'folding-table',
        name: 'Folding Table',
        description: 'Space-saving foldable tables'
      },
      {
        id: 'height-adjustable-table',
        name: 'Height Adjustable Table',
        description: 'Electric standing desks with memory presets'
      },
      {
        id: 'training-table',
        name: 'Training Table',
        description: 'Modular tables for training rooms'
      },
      {
        id: 'executive-table',
        name: 'Executive Table',
        description: 'Luxury desks for executive offices'
      },
      {
        id: 'study-table',
        name: 'Study Table',
        description: 'Student-friendly study desks'
      }
    ]
  },
  {
    id: 'accessories',
    name: 'Accessories',
    description: 'Essential accessories for your workspace',
    icon: '🔧',
    subcategories: [
      {
        id: 'footrest',
        name: 'Footrest',
        description: 'Footrests for improved posture'
      },
      {
        id: 'cable-tray',
        name: 'Cable Tray',
        description: 'Cable management solutions'
      },
      {
        id: 'monitor-stand',
        name: 'Monitor Stand',
        description: 'Monitor stands and arms'
      },
      {
        id: 'cup-holder',
        name: 'Cup Holder',
        description: 'Desk cup holders and organizers'
      },
      {
        id: 'Cpu-Stand',
        name: 'Cpu Stand',
        description: 'Protective desk mats and pads'
      },
      {
        id: 'storage-box',
        name: 'Storage Box',
        description: 'Under-desk storage boxes and drawers'
      }
    ]
  }
];

// Helper function to get category by id
export const getCategoryById = (categoryId) => {
  return categories.find(cat => cat.id === categoryId);
};

// Helper function to get subcategory by id
export const getSubcategoryById = (categoryId, subcategoryId) => {
  const category = getCategoryById(categoryId);
  if (!category) return null;
  return category.subcategories.find(sub => sub.id === subcategoryId);
};

// Helper function to get all subcategories for a category
export const getSubcategories = (categoryId) => {
  const category = getCategoryById(categoryId);
  return category ? category.subcategories : [];
};

// Helper function to format subcategory name for display
export const formatSubcategoryName = (subcategoryId) => {
  return subcategoryId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

