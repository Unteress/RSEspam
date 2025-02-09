import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const PersonsModel = sequelize.define("persons",{
    id:{
        autoIncrement:true,
        primaryKey:true,
        type: DataTypes.INTEGER,
    },
    name:{
        type:DataTypes.STRING,
        allowNull:true,
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull:true,
      },
    adress: {
        type: DataTypes.STRING,
        allowNull:true,
    },
    photo: {
        type: DataTypes.STRING,
        allowNull:true,
    },  
    
},
{
    timestamps:false
}
)
