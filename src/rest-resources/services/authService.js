// const bcrypt = require("bcryptjs");
// const pool = require("../config/database");
// const { generateToken } = require("../config/jwt");
// ;

// class AuthService {
//   async registerUser(userData) {
//     const { name, email, password, role, phone } = userData;

//     const userExists = await pool.query(
//       "SELECT * FROM users WHERE email = $1",
//       [email],
//     );

//     if (userExists.rows.length > 0) {
//       throw new Error("User already exists");
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = await pool.query(
//       "INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *",
//       [name, email, hashedPassword, role || "user", phone],
//     );

//     const token = generateToken(newUser.rows[0].id, newUser.rows[0].role);
//     return { user: newUser.rows[0], token };
//   }
//   async loginUser(credentials) {
//     const { email, password } = credentials;
//     const user = await pool.query("SELECT * FROM users WHERE email =$1", [
//       email,
//     ]);

//     if (user.rows.length === 0) {
//       throw new Error("Invalid email or password");
//     }
//     const isPasswordValid = await bcrypt.compare(
//       password,
//       user.rows[0].password,
//     );
//     if (!isPasswordValid) {
//       throw new Error("Invalid email or password");
//     }
//     const token = generateToken(user.rows[0].id, user.rows[0].role);
//     const { password: pwd, ...userWithoutPassword } = user.rows[0];
//     return { user: userWithoutPassword, token };
//   }

//   async getUserById(userId){
//     const user = await pool.query("SELECT id , name , email , role , phone . created_at FROM users WHERE id = $1" , [userId]);
//      if (user.rows.length === 0) {
//       throw new Error('User not found');
//     }
//  return user.rows[0];
//   }
// }

// export default new AuthService();

import User from "../../db/models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import CustomError from "../../utils/customError.js";

class AuthService {
  async registerUser(userData) {
    const { name, email, password, role, phone } = userData;

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw CustomError.conflict("User already exists with this email");
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      phone,
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE },
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  async loginUser(credentials) {
    const { email, password } = credentials;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw CustomError.unauthorized("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw CustomError.unauthorized("Invalid email or password");
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE },
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  async getUserById(userId) {
    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "role", "phone", "created_at"],
    });

    if (!user) {
      throw CustomError.notFound("User not found");
    }

    return user;
  }
}

export default new AuthService();
