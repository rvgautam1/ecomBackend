import { Sequelize } from "sequelize";
import dotenv from "dotenv";


dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,          
  process.env.DB_USER,         
  process.env.DB_PASSWORD,       
  {
    
    host: process.env.DB_HOST || "localhost",     
    port: process.env.DB_PORT || 5432,          
    
    // Database type (tells Sequelize to use PostgreSQL driver)
    dialect: "postgres",
    
    // Logging: Show SQL queries in development, silent in production
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    
    // Connection Pool Configuration 
    pool: {
      max: 10,      // Maximum 10 concurrent connections
      min: 0,       // Minimum 0 idle connections
      acquire: 30000,  // Wait max 30 seconds for connection
      idle: 10000   // Close idle connections after 10 seconds
    }
  }
);

// export sequalize instance 
export default sequelize;
