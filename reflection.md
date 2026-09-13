\# Dockerization Reflection – RosterUp



\## Overview



For this task, I individually dockerised the RosterUp application. RosterUp is a web application developed using Node.js and Express, with MongoDB used for data storage. The purpose of this task was to make the application easier to run in a consistent containerised environment using Docker and Docker Compose.



\## Dockerfile



I created a Dockerfile using the Node.js 20 Bookworm Slim image as the base image. The application uses `/app` as the working directory. The `package.json` and `package-lock.json` files are copied first and `npm ci` is used to install the required dependencies. The remaining application files are then copied into the container.



Port 3000 is exposed because the RosterUp server runs on this port. The container starts the application using `npm start`.



This approach separates the application environment from the host machine and provides a repeatable way to install and run the application.



\## Docker Compose



I used Docker Compose to run both the RosterUp application and MongoDB together. The Compose configuration contains two services: `app` and `mongo`.



The MongoDB service uses the MongoDB 8.0 image and stores database data in a named Docker volume. A health check is included to verify that MongoDB is ready before the application starts.



The RosterUp application is built from the Dockerfile and is exposed through port 3000. The application connects to MongoDB using the Docker service name `mongo` rather than `localhost`. This allows the two containers to communicate through the Docker Compose network.



\## Student Identity Endpoint



As required for the SIT725 HD Dockerization task, I added the `/api/student` endpoint to `server.js`.



The endpoint returns my student identity information in JSON format:



\- Name: Poojitha Yarra

\- Student ID: s226171127



This endpoint provides a simple way to verify that the correct application code is running inside the container.



\## Challenges and Troubleshooting



One challenge during the Dockerization process was ensuring that MongoDB and the Node.js application could communicate correctly. When applications run in separate containers, `localhost` refers to the individual container rather than the MongoDB container. I therefore configured the application to use `mongodb://mongo:27017/rosterup`, where `mongo` is the Docker Compose service name.



Another important consideration was ensuring that the existing RosterUp functionality was not replaced when adding the Dockerization requirements. I retained the existing Express and Socket.io server implementation and added the student endpoint without removing the existing routes.



\## Outcome



The final setup provides a reproducible Docker environment containing the RosterUp Node.js application and MongoDB database. Docker Compose manages the services, networking, database volume and startup dependency.



This task improved my understanding of containerisation, Dockerfiles, Docker Compose networking, service dependencies and running a Node.js application with MongoDB in separate containers.

