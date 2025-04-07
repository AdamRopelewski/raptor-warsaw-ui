# Raptor Warsaw UI

This project contains a frontend application and a transit service backend. The project uses Docker Compose to orchestrate the services.

## Services

- **frontend**: The UI application built from source. It runs on port 8080 and is configured to use Flask.
- **transit-service**: Provides public transit data and routing connections. It uses the latest image from [ghcr.io/naviqore/public-transit-service](https://ghcr.io/naviqore/public-transit-service:latest) and serves on port 8081 (mapped to internal port 8080).

## Docker Compose

The `docker-compose.yml` file defines the following:
- **Frontend Service**: 
  - Builds the image.
  - Exposes port 8080.
  - Sets environment variables for Flask and external API URL.
- **Transit Service**:
  - Pulls the latest published image.
  - Configures the GTFS static URI for transit data.
  - Exposes port 8081.

## Setup and Usage

1. Ensure Docker and Docker Compose are installed.
2. Clone the repository.
3. Navigate to the project directory.
4. Run the following command to start the services:

   ```bash
   docker-compose up --build