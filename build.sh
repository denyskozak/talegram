git reset --hard HEAD
git pull origin master
npm i
npm run build
rm -rf /var/www/talegramfrontend/ && cp -r dist/ /var/www/talegramfrontend/

cd backend
npm i
npm run build
pm2 restart index

cd ../admin
npm i
npm run build
rm -rf /var/www/talegrafrontendadmin/ && cp -r dist/ /var/www/talegrafrontendadmin/
