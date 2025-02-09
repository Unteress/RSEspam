import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";
import { UserModel } from "./UserModel.js";
import { MessageModel } from "./MessageModel.js";

export const ChatModel = sequelize.define(
  "chats",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user1_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    user2_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    last_message_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "messages",
        key: "id",
      },
    },
    last_message_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
  }
);

UserModel.hasMany(ChatModel, { foreignKey: "user1_id", as: "user1Chats" });
UserModel.hasMany(ChatModel, { foreignKey: "user2_id", as: "user2Chats" });
ChatModel.belongsTo(UserModel, { foreignKey: "user1_id", as: "user1" });
ChatModel.belongsTo(UserModel, { foreignKey: "user2_id", as: "user2" });
ChatModel.belongsTo(MessageModel, { foreignKey: "last_message_id", as: "lastMessage" });
