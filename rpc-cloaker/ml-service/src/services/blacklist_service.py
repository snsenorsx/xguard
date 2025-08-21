import httpx
import structlog
from typing import Optional
import asyncio

logger = structlog.get_logger()


class BlacklistService:
    """Service for checking and managing IP blacklists."""
    
    def __init__(self, backend_url: str = "http://backend:3000", api_timeout: float = 5.0):
        self.backend_url = backend_url.rstrip('/')
        self.api_timeout = api_timeout
        self.client = httpx.AsyncClient(timeout=api_timeout)
    
    async def is_blacklisted(self, ip_address: str) -> bool:
        """
        Check if an IP address is in the blacklist.
        Returns True if blacklisted, False otherwise.
        Fails open (returns False) on errors for availability.
        """
        try:
            url = f"{self.backend_url}/blacklist/check/{ip_address}"
            response = await self.client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                return data.get('isBlacklisted', False)
            elif response.status_code == 400:
                logger.warning("Invalid IP format for blacklist check", ip=ip_address)
                return False
            else:
                logger.error("Blacklist check failed", 
                           ip=ip_address, 
                           status_code=response.status_code,
                           response=response.text)
                return False
                
        except httpx.TimeoutException:
            logger.warning("Blacklist check timeout", ip=ip_address)
            return False
        except httpx.ConnectError:
            logger.warning("Cannot connect to backend for blacklist check", ip=ip_address)
            return False
        except Exception as e:
            logger.error("Unexpected error during blacklist check", 
                        ip=ip_address, 
                        error=str(e))
            return False
    
    async def add_to_blacklist(self, 
                             ip_address: str, 
                             reason: str,
                             detection_type: str = "bot",
                             confidence_score: float = 1.0,
                             expires_hours: Optional[int] = 24,
                             campaign_id: Optional[str] = None) -> bool:
        """
        Add an IP to the blacklist.
        Returns True if successfully added, False otherwise.
        """
        try:
            url = f"{self.backend_url}/blacklist"
            
            payload = {
                "ipAddress": ip_address,
                "reason": reason,
                "detectionType": detection_type,
                "confidenceScore": confidence_score,
                "campaignId": campaign_id
            }
            
            # Set expiration time if specified
            if expires_hours is not None:
                from datetime import datetime, timedelta
                expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
                payload["expiresAt"] = expires_at.isoformat()
            
            # Note: This endpoint requires authentication in production
            # For now, we'll need to handle this differently or make it public
            response = await self.client.post(url, json=payload)
            
            if response.status_code in [200, 201]:
                logger.info("IP added to blacklist", 
                          ip=ip_address, 
                          reason=reason,
                          confidence=confidence_score)
                return True
            else:
                logger.error("Failed to add IP to blacklist",
                           ip=ip_address,
                           status_code=response.status_code,
                           response=response.text)
                return False
                
        except Exception as e:
            logger.error("Error adding IP to blacklist", 
                        ip=ip_address, 
                        error=str(e))
            return False
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Global blacklist service instance
blacklist_service: Optional[BlacklistService] = None


async def get_blacklist_service() -> BlacklistService:
    """Get or create the global blacklist service instance."""
    global blacklist_service
    if blacklist_service is None:
        blacklist_service = BlacklistService()
    return blacklist_service


async def cleanup_blacklist_service():
    """Cleanup the global blacklist service instance."""
    global blacklist_service
    if blacklist_service:
        await blacklist_service.close()
        blacklist_service = None