const express = require('express');
const router = express.Router();
const { dataSource } = require('../db/data-source');
const logger = require('../utils/logger')('Coach');
const { isUndefined, isNotValidString, isNotValidInteger } = require('../utils/validUtils');


router.get('/', async (req,res,next) => {
    try{
        const { per, page } = req.query
        if (isUndefined(per) || isNotValidString(per) ||
            isUndefined(page) || isNotValidString(page)) {
            res.status(400).json({
            status: 'failed',
            message: '欄位未填寫正確'
        });
        return;
        };
        // per & page 轉成數字
        const perNumber = parseInt(per, 10);
        const pageNumber = parseInt(page, 10);
        const skip = (pageNumber - 1) * perNumber; // 分頁處理

        if (isUndefined(perNumber) || isNotValidInteger(perNumber) ||
            isUndefined(pageNumber) || isNotValidInteger(pageNumber) ) {
            return res.status(400).json({
                status: 'failed',
                message: 'per 和 page 必須是正整數'
            });
        }

        // 取得教練列表
        const coach = await dataSource.getRepository('Coach').find({
            select: {
                id: true,
                User: {
                    name: true
                }
            },
            relations: {
                User: true
            },
            take: perNumber,  // 限制回傳筆數
            skip,
            order: { created_at: 'DESC' } // 讓最新的資料排前面
        });
        res.status(200).json({
            status: 'success',
            data: coach
        });

    }catch(error){
        logger.error(error);
        next(error);
    };
});

router.get('/:coachId', async (req,res,next) => {
    try{
        const { coachId } = req.params;
        if(isUndefined(coachId) || isNotValidString(coachId)){
            res.status(400).json({
                status: 'failed',
                message: '欄位未填寫正確'
            });
            return;
        };

        const coachRepo = await dataSource.getRepository('Coach')
        const coach = await coachRepo.findOne({
            where: { id: coachId },
            relations: ["User"],
            select: ["id", "experience_years", "description", "profile_image_url", "created_at", "updated_at"]
        });
        if(!coach) {
            logger.warn('找不到該教練');
            res.status(400).json({
                status: 'failed',
                message: '找不到該教練'
            });
            return;
        };

        res.status(200).json({
            status: 'success',
            data: coach
        });

    }catch(error){
        logger.error(error);
        next(error);
    };
});

module.exports = router;