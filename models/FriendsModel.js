import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";
import { UserModel } from './UserModel.js';


export const FriendsModel = sequelize.define(
  "friends",
  {
    id: {
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users", // Referencia al modelo 'users'
        key: "id",
      },
    },
    friend_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users", // Referencia al modelo 'users'
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      defaultValue: "pending",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
  }
);


FriendsModel.belongsTo(UserModel, { foreignKey: "friend_id", as: "receiver" });

FriendsModel.belongsTo(UserModel, { foreignKey: 'user_id', as: 'sender' });

