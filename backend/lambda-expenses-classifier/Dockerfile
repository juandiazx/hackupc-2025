FROM public.ecr.aws/lambda/python:3.12

# Copy code
COPY expenses_classifier.py ${LAMBDA_TASK_ROOT}
COPY requirements.txt .

# Install dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

# Command Lambda will use to run your function
CMD ["expenses_classifier.handler"]
