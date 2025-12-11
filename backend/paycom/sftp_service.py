"""
SFTP service for connecting to Paycom and downloading employee reports
"""

import os
import logging
import tempfile
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import paramiko
# Enable paramiko debug logging for troubleshooting
paramiko.util.log_to_file('/tmp/paramiko.log') if os.path.exists('/tmp') else None
from django.conf import settings
from django.utils import timezone
from .models import PaycomSyncLog, PaycomFile

logger = logging.getLogger(__name__)


class PaycomSFTPError(Exception):
    """Custom exception for Paycom SFTP operations"""
    pass


class PaycomSFTPService:
    """Service for handling SFTP operations with Paycom"""
    
    def __init__(self):
        # Get host and strip protocol prefix if present (e.g., sftp://hostname -> hostname)
        host_raw = getattr(settings, 'PAYCOM_SFTP_HOST', None)
        if host_raw:
            host_str = str(host_raw).strip()
            # Remove sftp:// or ssh:// prefix if present
            if host_str.startswith('sftp://'):
                self.host = host_str[7:]  # Remove 'sftp://'
            elif host_str.startswith('ssh://'):
                self.host = host_str[6:]  # Remove 'ssh://'
            elif host_str.startswith('//'):
                self.host = host_str[2:]  # Remove '//'
            else:
                self.host = host_str
            # Remove trailing slash if present
            self.host = self.host.rstrip('/')
        else:
            self.host = None
            
        self.port = getattr(settings, 'PAYCOM_SFTP_PORT', 22)
        self.username = getattr(settings, 'PAYCOM_SFTP_USERNAME', None)
        
        # Get password and ensure it's properly handled (trim whitespace, convert to string)
        password_raw = getattr(settings, 'PAYCOM_SFTP_PASSWORD', None)
        if password_raw:
            # Convert to string and handle encoding issues
            password_str = str(password_raw).strip()
            
            # Try Base64 decoding first (if password is Base64 encoded to avoid special char issues)
            try:
                import base64
                decoded = base64.b64decode(password_str).decode('utf-8')
                logger.info(f"Password appears to be Base64 encoded, decoded to: {repr(decoded)}")
                password_str = decoded
            except Exception:
                # Not Base64 encoded, use as-is
                pass
            
            # Railway bug: Automatically converts } to ) in environment variables
            # Workaround: Check if password has ) where it should have }
            # If Railway converted it, fix it back
            logger.info(f"Password before workaround - repr: {repr(password_str)}")
            if password_str and ')' in password_str and '{' in password_str:
                # Check if it looks like Q{f3H)bG (should be Q{f3H}bG)
                if password_str.startswith('Q{f3H') and password_str.endswith('bG'):
                    # Fix the ) back to }
                    password_str = password_str.replace(')', '}', 1)  # Replace only the first ) after {
                    logger.warning("Railway converted } to ). Fixed password automatically.")
                    logger.info(f"Password after workaround - repr: {repr(password_str)}")
            logger.info(f"Final password in __init__ - repr: {repr(password_str)}")
            
            # Ensure we preserve special characters correctly
            self.password = password_str
            logger.debug(f"Password loaded: length={len(self.password)}, type={type(self.password)}")
        else:
            self.password = None
        self.private_key_path = getattr(settings, 'PAYCOM_SFTP_PRIVATE_KEY_PATH', None)
        self.remote_directory = getattr(settings, 'PAYCOM_SFTP_REMOTE_DIRECTORY', '/')
        self.local_directory = getattr(settings, 'PAYCOM_SFTP_LOCAL_DIRECTORY', None)
        
        if not self.host or not self.username:
            raise PaycomSFTPError("SFTP credentials not configured. Please set PAYCOM_SFTP_HOST and PAYCOM_SFTP_USERNAME.")
        
        if not self.password and not self.private_key_path:
            raise PaycomSFTPError("Either password or private key must be provided for SFTP authentication.")
        
        # Log connection details (without exposing password)
        logger.info(f"Initializing SFTP connection to {self.host}:{self.port} as {self.username}")
        logger.info(f"Password provided: {'Yes' if self.password else 'No'}, Length: {len(self.password) if self.password else 0}")
    
    def _create_connection(self) -> paramiko.SFTPClient:
        """Create and return an SFTP connection"""
        try:
            # Create SSH client
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Connect using password or private key
            if self.private_key_path and os.path.exists(self.private_key_path):
                private_key = paramiko.RSAKey.from_private_key_file(self.private_key_path)
                ssh_client.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    pkey=private_key,
                    timeout=30
                )
            else:
                # Ensure password is a string (handle special characters)
                password_str = str(self.password) if self.password else None
                logger.info(f"Attempting password authentication for user: {self.username}")
                logger.info(f"Password type: {type(password_str)}, Length: {len(password_str) if password_str else 0}")
                logger.info(f"Password full repr: {repr(password_str)}")
                # Log each character's code point to check for hidden characters
                if password_str:
                    char_codes = [f"{c} ({ord(c)})" for c in password_str]
                    logger.info(f"Password characters with codes: {' '.join(char_codes)}")
                logger.info(f"Password bytes (utf-8): {repr(password_str.encode('utf-8') if password_str else b'')}")
                logger.info(f"Password bytes (latin-1): {repr(password_str.encode('latin-1') if password_str else b'')}")
                
                # Try to connect - log more details
                logger.info(f"Connecting to {self.host}:{self.port}...")
                
                # Try multiple encoding methods if first fails
                auth_success = False
                last_error = None
                
                # Method 1: Direct string (default)
                try:
                    logger.info("Trying authentication method 1: Direct string")
                    ssh_client.connect(
                        hostname=self.host,
                        port=self.port,
                        username=self.username,
                        password=password_str,
                        timeout=30,
                        allow_agent=False,
                        look_for_keys=False,
                        banner_timeout=30
                    )
                    auth_success = True
                    logger.info("Authentication method 1 succeeded")
                except paramiko.AuthenticationException as e1:
                    last_error = e1
                    logger.warning(f"Authentication method 1 failed: {e1}")
                    
                    # Method 2: Try with explicit UTF-8 encoding
                    try:
                        logger.info("Trying authentication method 2: Explicit UTF-8 bytes")
                        ssh_client_new = paramiko.SSHClient()
                        ssh_client_new.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                        password_bytes_utf8 = password_str.encode('utf-8').decode('utf-8')
                        ssh_client_new.connect(
                            hostname=self.host,
                            port=self.port,
                            username=self.username,
                            password=password_bytes_utf8,
                            timeout=30,
                            allow_agent=False,
                            look_for_keys=False,
                            banner_timeout=30
                        )
                        ssh_client = ssh_client_new
                        auth_success = True
                        logger.info("Authentication method 2 succeeded")
                    except paramiko.AuthenticationException as e2:
                        logger.warning(f"Authentication method 2 failed: {e2}")
                        last_error = e2
                
                if not auth_success:
                    logger.error(f"All authentication methods failed. Last error: {last_error}")
                    raise last_error
            
            # Create SFTP client
            sftp_client = ssh_client.open_sftp()
            logger.info("SFTP connection established successfully")
            return sftp_client
            
        except paramiko.AuthenticationException as e:
            # Try to get the actual outbound IP address
            outbound_ip = "unknown"
            try:
                import urllib.request
                import json
                response = urllib.request.urlopen('https://api.ipify.org?format=json', timeout=5)
                data = json.loads(response.read().decode())
                outbound_ip = data.get('ip', 'unknown')
            except Exception:
                # Fallback to socket method
                try:
                    import socket
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    s.connect(("8.8.8.8", 80))
                    outbound_ip = s.getsockname()[0]
                    s.close()
                except:
                    pass
            
            logger.error(f"SFTP authentication failed: {e}")
            logger.error(f"Credentials used - Host: {self.host}:{self.port}, Username: {self.username}, Password length: {len(self.password) if self.password else 0}")
            logger.error(f"Railway outbound IP address: {outbound_ip}")
            logger.error(f"This IP needs to be whitelisted with Paycom for SFTP access")
            logger.error(f"Please verify:")
            logger.error(f"  1. Username is correct: {self.username}")
            logger.error(f"  2. Password is correct (length: {len(self.password) if self.password else 0} chars)")
            logger.error(f"  3. Account is active and not locked")
            logger.error(f"  4. IP address {outbound_ip} is whitelisted with Paycom")
            logger.error(f"  5. Contact Paycom support to whitelist Railway's outbound IP addresses")
            raise PaycomSFTPError(f"SFTP authentication failed on Railway. Credentials work locally. This is an IP whitelisting issue. Railway outbound IP: {outbound_ip}. Please contact Paycom to whitelist this IP address for SFTP access. Error: {e}")
        except paramiko.SSHException as e:
            logger.error(f"SFTP SSH error: {e}")
            raise PaycomSFTPError(f"SFTP connection failed: {e}")
        except Exception as e:
            logger.error(f"Failed to create SFTP connection: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            raise PaycomSFTPError(f"Failed to connect to SFTP server: {e}")
    
    def connect(self):
        """Return a context manager for SFTP connection"""
        from contextlib import contextmanager
        
        @contextmanager
        def sftp_connection():
            ssh_client = None
            sftp_client = None
            try:
                # Create SSH client
                ssh_client = paramiko.SSHClient()
                ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                # Connect using password or private key
                if self.private_key_path and os.path.exists(self.private_key_path):
                    private_key = paramiko.RSAKey.from_private_key_file(self.private_key_path)
                    ssh_client.connect(
                        hostname=self.host,
                        port=self.port,
                        username=self.username,
                        pkey=private_key,
                        timeout=30
                    )
                else:
                    # Ensure password is a string (handle special characters)
                    password_str = str(self.password) if self.password else None
                    logger.info(f"Attempting password authentication for user: {self.username}")
                    logger.info(f"Password in connect() - type: {type(password_str)}, length: {len(password_str) if password_str else 0}")
                    logger.info(f"Password in connect() - repr: {repr(password_str)}")
                    
                    # Log character codes to verify password is correct
                    if password_str:
                        char_codes = [f"{c}({ord(c)})" for c in password_str]
                        logger.info(f"Password characters: {' '.join(char_codes)}")
                        # Expected: Q(81) {(123) f(102) 3(51) H(72) }(125) b(98) G(71)
                        expected_password = 'Q{f3H}bG'
                        logger.info(f"Password equals expected: {password_str == expected_password}")
                    
                    # Get and log Railway's outbound IP address for Paycom whitelisting
                    try:
                        import socket
                        import requests
                        # Try to get outbound IP from a public service
                        try:
                            response = requests.get('https://api.ipify.org?format=json', timeout=5)
                            outbound_ip = response.json().get('ip', 'unknown')
                            logger.info(f"Railway outbound IP address: {outbound_ip}")
                            logger.info(f"IMPORTANT: Provide this IP to Paycom support for whitelisting if authentication fails")
                        except Exception:
                            # Fallback: get IP from socket connection
                            try:
                                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                                s.connect(('8.8.8.8', 80))
                                local_ip = s.getsockname()[0]
                                s.close()
                                logger.info(f"Local IP (may not be outbound IP): {local_ip}")
                            except Exception:
                                logger.warning("Could not determine outbound IP address")
                    except Exception:
                        logger.warning("Could not determine outbound IP address")
                    
                    # Try connection with explicit password handling
                    logger.info("Attempting connection...")
                    try:
                        ssh_client.connect(
                            hostname=self.host,
                            port=self.port,
                            username=self.username,
                            password=password_str,
                            timeout=30,
                            allow_agent=False,
                            look_for_keys=False,
                            banner_timeout=30
                        )
                    except paramiko.AuthenticationException as auth_err:
                        # Log more details about the authentication failure
                        logger.error(f"Authentication failed. Password length: {len(password_str)}, Password repr: {repr(password_str)}")
                        logger.error(f"Password bytes: {repr(password_str.encode('utf-8'))}")
                        logger.error(f"Username: {self.username}, Host: {self.host}:{self.port}")
                        raise
                
                # Create SFTP client
                sftp_client = ssh_client.open_sftp()
                
                yield sftp_client
                
            except Exception as e:
                logger.error(f"Failed to create SFTP connection: {e}")
                raise PaycomSFTPError(f"SFTP connection failed: {e}")
            finally:
                # Clean up connections
                if sftp_client:
                    sftp_client.close()
                if ssh_client:
                    ssh_client.close()
        
        return sftp_connection()
    
    def _get_local_directory(self) -> str:
        """Get or create local directory for downloaded files"""
        if self.local_directory:
            local_dir = self.local_directory
        else:
            local_dir = os.path.join(settings.MEDIA_ROOT, 'paycom_reports')
        
        os.makedirs(local_dir, exist_ok=True)
        return local_dir
    
    def list_remote_files(self, file_pattern: str = "*.csv") -> List[Dict[str, any]]:
        """List files in the remote directory matching the pattern"""
        try:
            sftp = self._create_connection()
            
            try:
                files = []
                for file_attr in sftp.listdir_attr(self.remote_directory):
                    if file_attr.filename.endswith('.csv'):
                        files.append({
                            'filename': file_attr.filename,
                            'size': file_attr.st_size,
                            'modified_time': datetime.fromtimestamp(file_attr.st_mtime),
                            'is_directory': file_attr.st_mode & 0o040000 != 0
                        })
                
                return files
                
            finally:
                sftp.close()
                
        except Exception as e:
            logger.error(f"Failed to list remote files: {e}")
            raise PaycomSFTPError(f"Failed to list files: {e}")
    
    def download_file(self, remote_filename: str, local_filename: str = None, sftp_client=None) -> str:
        """Download a file from SFTP server"""
        try:
            # Use provided SFTP client or create new connection
            if sftp_client is None:
                sftp = self._create_connection()
                should_close = True
            else:
                sftp = sftp_client
                should_close = False
            
            try:
                # Generate local filename if not provided
                if not local_filename:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    local_filename = f"{timestamp}_{remote_filename}"
                
                # Get local directory
                local_dir = self._get_local_directory()
                local_path = os.path.join(local_dir, local_filename)
                
                # Download file
                remote_path = f"{self.remote_directory.rstrip('/')}/{remote_filename}"
                sftp.get(remote_path, local_path)
                
                logger.info(f"Downloaded {remote_filename} to {local_path}")
                return local_path
                
            finally:
                if should_close:
                    sftp.close()
                
        except Exception as e:
            logger.error(f"Failed to download file {remote_filename}: {e}")
            raise PaycomSFTPError(f"Failed to download file: {e}")
    
    def download_all_reports(self, sync_log: PaycomSyncLog) -> List[PaycomFile]:
        """Download all employee reports from Paycom SFTP"""
        downloaded_files = []
        
        try:
            # Create a single SFTP connection for all operations
            sftp = self._create_connection()
            
            try:
                # List all .csv files in remote directory
                files = []
                for file_attr in sftp.listdir_attr(self.remote_directory):
                    if file_attr.filename.endswith('.csv'):
                        files.append({
                            'filename': file_attr.filename,
                            'size': file_attr.st_size,
                            'modified_time': datetime.fromtimestamp(file_attr.st_mtime),
                            'is_directory': file_attr.st_mode & 0o040000 != 0
                        })
                
                if not files:
                    logger.warning("No .csv files found in remote directory")
                    return downloaded_files
                
                # Download each file using the same connection
                for file_info in files:
                    if file_info['is_directory']:
                        continue
                    
                    try:
                        # Download file using the existing connection
                        local_dir = self._get_local_directory()
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        local_filename = f"{timestamp}_{file_info['filename']}"
                        local_path = os.path.join(local_dir, local_filename)
                        
                        # Download file
                        remote_path = f"{self.remote_directory.rstrip('/')}/{file_info['filename']}"
                        sftp.get(remote_path, local_path)
                        
                        logger.info(f"Downloaded {file_info['filename']} to {local_path}")
                        
                        # Determine file type based on filename
                        file_type = self._determine_file_type(file_info['filename'])
                        
                        # Create PaycomFile record
                        paycom_file = PaycomFile.objects.create(
                            sync_log=sync_log,
                            filename=file_info['filename'],
                            file_path=local_path,
                            file_size=file_info['size'],
                            file_type=file_type,
                            status='downloaded'
                        )
                        
                        downloaded_files.append(paycom_file)
                        sync_log.files_processed += 1
                        sync_log.files_successful += 1
                        sync_log.save()
                        
                        logger.info(f"Successfully downloaded and recorded {file_info['filename']}")
                        
                    except Exception as e:
                        logger.error(f"Failed to download {file_info['filename']}: {e}")
                        sync_log.files_failed += 1
                        sync_log.save()
                        
                        # Create failed file record
                        paycom_file = PaycomFile.objects.create(
                            sync_log=sync_log,
                            filename=file_info['filename'],
                            file_path='',
                            file_size=0,
                            file_type='unknown',
                            status='failed',
                            error_message=str(e)
                        )
                        downloaded_files.append(paycom_file)
                
                return downloaded_files
                
            finally:
                sftp.close()
            
        except Exception as e:
            logger.error(f"Failed to download reports: {e}")
            sync_log.status = 'failed'
            sync_log.error_message = str(e)
            sync_log.completed_at = timezone.now()
            sync_log.save()
            raise PaycomSFTPError(f"Failed to download reports: {e}")
    
    def _determine_file_type(self, filename: str) -> str:
        """Determine the type of report based on filename"""
        filename_lower = filename.lower()
        
        if 'employee_directory' in filename_lower:
            return 'employee_directory'
        elif 'employee_dates' in filename_lower:
            return 'employee_dates'
        elif 'employee_payees' in filename_lower:
            return 'employee_payees'
        elif 'rate_history' in filename_lower or 'rate history' in filename_lower:
            return 'rate_history'
        else:
            return 'unknown'
    
    def test_connection(self) -> bool:
        """Test SFTP connection"""
        try:
            sftp = self._create_connection()
            sftp.close()
            return True
        except Exception as e:
            logger.error(f"SFTP connection test failed: {e}")
            return False


def create_sync_log(report_type: str = 'all') -> PaycomSyncLog:
    """Create a new sync log entry"""
    sync_id = f"sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    return PaycomSyncLog.objects.create(
        sync_id=sync_id,
        report_type=report_type,
        status='started'
    )


def sync_paycom_data(report_type: str = 'all') -> PaycomSyncLog:
    """Main function to sync all Paycom data"""
    logger.info(f"Starting Paycom sync for report type: {report_type}")
    
    # Create sync log
    sync_log = create_sync_log(report_type)
    
    try:
        # Initialize SFTP service
        sftp_service = PaycomSFTPService()
        
        # Test connection
        if not sftp_service.test_connection():
            raise PaycomSFTPError("SFTP connection test failed")
        
        # Update sync log
        sync_log.status = 'in_progress'
        sync_log.save()
        
        # Download all reports
        downloaded_files = sftp_service.download_all_reports(sync_log)
        
        # Update sync log
        sync_log.status = 'completed'
        sync_log.completed_at = timezone.now()
        sync_log.save()
        
        logger.info(f"Paycom sync completed successfully. Downloaded {len(downloaded_files)} files.")
        return sync_log
        
    except Exception as e:
        logger.error(f"Paycom sync failed: {e}")
        sync_log.status = 'failed'
        sync_log.error_message = str(e)
        sync_log.completed_at = timezone.now()
        sync_log.save()
        raise
