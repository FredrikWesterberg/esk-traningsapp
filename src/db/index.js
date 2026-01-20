const { Sequelize, DataTypes } = require('sequelize');

// Databaskonfiguration
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: process.env.DATABASE_URL?.includes('render.com') ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {},
  logging: false
});

// ============ MODELLER ============

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => Date.now().toString()
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

const Invite = sequelize.define('Invite', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => Date.now().toString()
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false
  },
  usedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'invites',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

const Training = sequelize.define('Training', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => Date.now().toString()
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  exerciseIds: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'trainings',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

const Exercise = sequelize.define('Exercise', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => Date.now().toString()
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  video: {
    type: DataTypes.STRING,
    allowNull: true
  },
  youtubeUrl: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'exercises',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Session-tabell skapas automatiskt av connect-pg-simple

// Initiera databas
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Databasanslutning lyckades!');

    // Synka tabeller (skapa om de inte finns)
    await sequelize.sync();
    console.log('Databastabeller synkade.');

    // Skapa initial inbjudningskod om det inte finns några användare
    const userCount = await User.count();
    const availableInviteCount = await Invite.count({ where: { usedBy: null } });

    if (userCount === 0 && availableInviteCount === 0) {
      await Invite.create({
        id: 'initial',
        code: 'ESKADMIN1',
        createdBy: 'system'
      });
      console.log('Initial inbjudningskod skapad: ESKADMIN1');
    }

    return true;
  } catch (error) {
    console.error('Databasfel:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  User,
  Invite,
  Training,
  Exercise,
  initDatabase
};
