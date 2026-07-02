# DNS Configuration for Creatools

All 3 domains point to the same EC2 instance via its Elastic IP address.

## Prerequisites

- Elastic IP allocated and associated with your EC2 instance
- Access to DNS management for all 3 domains (e.g., Cloudflare, Route53, Namecheap, GoDaddy)

## DNS Records

Replace `YOUR_ELASTIC_IP` with the actual Elastic IP from the provisioning step.

### creatools.co (Main Site)

| Type  | Name | Value             | TTL  |
|-------|------|-------------------|------|
| A     | @    | YOUR_ELASTIC_IP   | 300  |
| CNAME | www  | creatools.co      | 300  |

### creatools.stream (Overlay Links)

| Type  | Name | Value             | TTL  |
|-------|------|-------------------|------|
| A     | @    | YOUR_ELASTIC_IP   | 300  |
| CNAME | www  | creatools.stream  | 300  |

### creatools.live (User Profiles)

| Type  | Name | Value             | TTL  |
|-------|------|-------------------|------|
| A     | @    | YOUR_ELASTIC_IP   | 300  |
| CNAME | www  | creatools.live    | 300  |

## Notes

- **TTL**: Set to 300 (5 minutes) initially for faster propagation during setup. You can increase to 3600 (1 hour) after everything is confirmed working.
- **Propagation**: DNS changes can take 5 minutes to 48 hours to propagate globally, though usually it's under 30 minutes.
- **Verification**: Use `dig` or `nslookup` to verify records:
  ```bash
  dig creatools.co +short
  dig creatools.stream +short
  dig creatools.live +short
  ```
- **SSL**: DNS must be fully propagated before running the SSL setup script, as Let's Encrypt validates domain ownership via HTTP challenge.

## If Using AWS Route53

If your domains are managed in Route53, create hosted zones for each domain and add the A records:

```bash
# Example for creatools.co
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "creatools.co",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "YOUR_ELASTIC_IP"}]
      }
    }]
  }'
```

## If Using Cloudflare

1. Add each domain to Cloudflare
2. Create A records pointing to the Elastic IP
3. **Important**: Set proxy status to "DNS only" (gray cloud) during SSL setup
4. After SSL is configured via Certbot, you can enable Cloudflare proxy (orange cloud) if desired
5. If using Cloudflare proxy, set SSL/TLS mode to "Full (strict)"
