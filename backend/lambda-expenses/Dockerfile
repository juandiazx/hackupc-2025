FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY main.py ./
COPY utils.py ./
COPY expenses_classifier.py ./
COPY expenses_predictor.py ./

CMD ["main.handler"]
