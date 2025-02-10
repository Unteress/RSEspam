import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";
import { UserModel } from "./UserModel.js";

export const MessageModel = sequelize.define(
  "messages",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firebase_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    receiver_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    media_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    message_status: {
      type: DataTypes.ENUM("sent", "delivered", "read"),
      defaultValue: "sent",
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
  }
);

UserModel.hasMany(MessageModel, { foreignKey: "sender_id", as: "sentMessages" });
UserModel.hasMany(MessageModel, { foreignKey: "receiver_id", as: "receivedMessages" });
MessageModel.belongsTo(UserModel, { foreignKey: "sender_id", as: "sender" });
MessageModel.belongsTo(UserModel, { foreignKey: "receiver_id", as: "receiver" });
