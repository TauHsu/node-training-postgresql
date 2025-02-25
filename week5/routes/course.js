const express = require('express');
const { IsNull } = require('typeorm')

const router = express.Router();
const config = require('../config/index');
const { dataSource } = require('../db/data-source');
const logger = require('../utils/logger')('Course');
const auth = require('../middlewares/auth')({
    secret: config.get('secret').jwtSecret,
    userRepository: dataSource.getRepository('User'),
    logger
});

const { isUndefined, isNotValidString } = require('../utils/validUtils');

router.get('/', async(req,res,next) => {
    try{
        const course = await dataSource.getRepository('Course').find({
            select: {
                id: true,
                User: { name: true },
                Skill: { name: true },
                name: true,
                description: true,
			    start_at: true,
			    end_at: true,
		        max_participants: true
            },
            relations: {
                User: true,
                Skill: true
            }
        });
        res.status(200).json({
            status: "success",
            data: course.map((course) => {
                return {
                  id: course.id,
                  name: course.name,
                  description: course.description,
                  start_at: course.start_at,
                  end_at: course.end_at,
                  max_participants: course.max_participants,
                  coach_name: course.User.name,
                  skill_name: course.Skill.name
                }
            })
        });
    }catch(error){
        logger.error(error);
        next(error);
    };
});

router.post('/:courseId', auth, async (req,res,next) => {
    try{
        const { id } = req.user;
        const { courseId }= req.params;
        if(isUndefined(courseId) || isNotValidString(courseId)){
            res.status(400).json({
                status: 'failed',
                message: '欄位未填寫正確'
            });
            return;
        };

        const courseRepo = await dataSource.getRepository('Course');
        const course = await courseRepo.findOneBy({ id: courseId });
        if(!course){
            res.status(400).json({
                status: 'failed',
                message: 'ID錯誤'
            });
            return;
        };

        const creditPurchaseRepo = await dataSource.getRepository('CreditPurchase');
        const courseBookingRepo = await dataSource.getRepository('CourseBooking');
        const totalPurchaseCredit = await creditPurchaseRepo.sum('purchased_credits',{
            user_id: id
        });
        const usedCredit = await courseBookingRepo.count({
            where: {
                user_id: id,
                cancelledAt: IsNull()
            }
        });
        const courseBookingCount = await courseBookingRepo.count({
            where: {
                user_id: id,
                cancelledAt: IsNull()
            }
        });

        if(usedCredit >= totalPurchaseCredit){
            res.status(400).json({
                status: 'failed',
                message: '已無可使用堂數'
            });
            return;
        }else if(courseBookingCount >= course.max_participants){
            res.status(400).json({
                status: 'failed',
                message: '已達最大參加人數，無法參加'
            });
            return;
        }

        const userCourseBooking = await courseBookingRepo.findOne({
            where: {
                user_id: id,
                course_id: courseId 
            }
        });
        if(userCourseBooking){
            res.status(400).json({
                status: 'failed',
                message: '已經報名過此課程'
            });
            return;
        };

        const newCourseBooking = await courseBookingRepo.create({
            user_id: id,
            course_id: courseId
        });
        await courseBookingRepo.save(newCourseBooking); 
        res.status(201).json({
            status: "success",
	        data: null
        });
    }catch(error){
        logger.error(error);
        next(error);
    };
});

router.delete('/:courseId', auth, async (req,res,next) => {
    try{
        const { id } = req.user;
        const { courseId } = req.params;
        if(isUndefined(courseId) || isNotValidString(courseId)){
            res.status(400).json({
                status: 'failed',
                message: '欄位未填寫正確'
            });
            return;
        };

        const courseBookingRepo = await dataSource.getRepository('CourseBooking');
        const existCourseBooking = await courseBookingRepo.findOne({
            where: {
                user_id: id,
                course_id: courseId,
                cancelledAt: IsNull()
            }
        });
        if(!existCourseBooking){
            res.status(400).json({
                status: 'failed',
                message: '課程不存在'
            });
            return;
        };

        const updateResult = await courseBookingRepo.update(
            {
                user_id: id,
                course_id: courseId,
                cancelledAt: IsNull()
            },
            {
                cancelledAt: new Date().toISOString()
            }
        );

        if(updateResult.affected === 0){
            res.status(400).json({
                status: 'failed',
                message: '取消失敗'
            });
            return;
        };

        res.status(201).json({
            status: "success",
	        data: null
        });
    }catch(error){
        logger.error(error);
        next(error);
    };
});

module.exports = router;