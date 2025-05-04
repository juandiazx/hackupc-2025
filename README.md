# 💸 Wise Wallet — HackUPC 2025

[View on Devpost](https://devpost.com/software/spendly-nx3hb0?ref_content=user-portfolio&ref_feature=in_progress)

Wise Wallet is a smart personal finance assistant that uses AI to **classify** and **predict** your ***expenses***, and provides insightful feedback through a voice assistant interface with **Alexa Echo Dot**. It combines a web-based frontend, serverless backend, and machine learning models to empower users with intelligent budgeting and financial planning tools.

## 🧠 Features

* **Automatic Expense Classification** using a Random Forest Classifier ML model hosted on AWS S3.
* **Monthly Expense Prediction** using a Random Forest Regressor model that we also developed.
* **Conversational Feedback** through Alexa and Gemini integration.
* **All-in-One Repository**: Frontend, backend, and ML models included for easy deployment and collaboration on 36 hours.


## 📁 Project Structure

```
wise_wallet
├── frontend/                    # Web application UI
├── backend/                     # Backend services
│   ├── lambda_expenses/         # Lambda for classifying/predicting expenses
│   ├── ml_models/               # Trained ML models
│   │   ├── expenses_classifier/
│   │   └── expenses_predictor/
│   └── my_alexa_skill/          # Lambda to interface Alexa with expenses and Gemini
```


## 🚀 How It Works

### 1. Expense Processing via Lambda

* The Lambda in `lambda_expenses/` receives a request to:

  * `classify-expenses`: Classifies rows from a CSV using a classifier model from S3.
  * `predict-expenses`: Forecasts future expenses using a predictor model.

### 2. ML Models

* Located in `ml_models/`, these are pre-trained and stored in corresponding S3 buckets:

  * `expenses-classifier-model`
  * `expenses-predictor-model`

### 3. Alexa + Gemini Integration

* The Lambda in `my_alexa_skill/` fetches the expenses and forwards the user's query to **Gemini** for AI-generated financial insights using system and queries prompts.

## 🔧 Technologies Used

* **Frontend**: React, Typescript, Tailwind CSS
* **Backend**: AWS Lambda, S3, Docker, Python Boto3
* **Machine Learning**: scikit-learn, pandas, etc.
* **Voice Assistant**: Alexa Skills Kit, Gemini AI

## 🛠️ Setup

### Prerequisites

* AWS CLI configured
* Python 3.8+
* Node.js
* AWS IAM credentials with Lambda + S3 access
Here’s the adapted section for deploying the Lambdas as Docker images, now integrated professionally into the README:

## 🐳 Deploying Lambda as Docker Images

Due to the size of the ML libraries, each Lambda is packaged and deployed as a **Docker image** instead of a ZIP archive.

#### Steps to Deploy

1. **Build the Docker image:**

```bash
cd backend/lambda_expenses
docker build -t expense-lambda .
```

2. **Create an ECR repository**:

```bash
aws ecr create-repository --repository-name expense-lambda
```

3. **Tag and push the image to ECR:**

```bash
docker tag expense-lambda:latest <[ecr_repo_uri]>:latest
docker push <[ecr_repo_uri]>/expense-lambda:latest
```

4. **Create the Lambda function:**

```bash
aws lambda create-function \
  --function-name expense-lambda \
  --package-type Image \
  --code ImageUri=<[ecr_repo_uri]>/expense-lambda:latest \
  --role arn:aws:iam::<[aws_user_id]>:role/lambda-execution-role
```

> 🛡️ **Note:** You must create an appropriate [IAM role for Lambda execution](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html) with permissions for:
>
> * `logs:*` (for CloudWatch)
> * `s3:*` (for model and data access)



Let me know if you'd like a similar section for the Alexa skill or the ML model training/deployment process.

## 🍃 Frontend Setup

```bash
cd frontend
npm install
npm start
```


## 📊 Data Flow

1. **Frontend** → API Gateway → `lambda_expenses` → S3 ML Model → Prediction/Classification
2. **Alexa** → `my_alexa_skill` Lambda → S3 → Gemini → Response to user

## 🧪 Example API Usage

```http
GET /?action=classify-expenses
GET /?action=predict-expenses
```

## 👥 Team

* Manuel Borregales, Juan Diaz, Alejandro Rosado, Mario Luis Mesa
* Built at **HackUPC 2025**


## 📃 License

MIT License — feel free to use, fork, and expand!
