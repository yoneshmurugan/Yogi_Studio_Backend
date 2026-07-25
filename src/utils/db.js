const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-south-1" });

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: true,   
    removeUndefinedValues: true, 
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

module.exports = {
  docClient,
  TABLE_NAME: process.env.DYNAMODB_TABLE
};